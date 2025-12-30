import "server-only";

import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userSubscriptions, users } from "@/lib/db/schema";
import { getMaxDomainsForTier } from "@/lib/edge-config";
import { createLogger } from "@/lib/logger/server";
import type { UserTier } from "@/lib/schemas";

const logger = createLogger({ source: "user-subscription" });

export type UserSubscriptionData = {
  userId: string;
  tier: UserTier;
  maxDomains: number;
  /** When a canceled subscription ends. Null = no pending cancellation. */
  endsAt: Date | null;
};

/**
 * Get user's subscription data.
 * The subscription row is created automatically via better-auth database hooks.
 * maxDomains comes from Edge Config based on tier.
 */
export async function getUserSubscription(
  userId: string,
): Promise<UserSubscriptionData> {
  const [record] = await db
    .select({
      userId: userSubscriptions.userId,
      tier: userSubscriptions.tier,
      endsAt: userSubscriptions.endsAt,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (!record) {
    throw new Error(`Subscription not found for user: ${userId}`);
  }

  const maxDomains = await getMaxDomainsForTier(record.tier);

  return {
    userId,
    tier: record.tier,
    maxDomains,
    endsAt: record.endsAt,
  };
}

/**
 * Update user tier.
 *
 * If the subscription record doesn't exist (edge case where database hook failed
 * during user signup), creates the subscription with the specified tier.
 * This ensures webhook handlers don't fail permanently when subscription is missing.
 */
export async function updateUserTier(
  userId: string,
  tier: UserTier,
): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({ tier, updatedAt: new Date() })
    .where(eq(userSubscriptions.userId, userId))
    .returning({ userId: userSubscriptions.userId });

  if (updated.length === 0) {
    // Subscription record doesn't exist - create it with the specified tier.
    // This handles the edge case where the database hook failed during user signup.
    logger.warn("subscription not found, creating missing record", {
      userId,
      tier,
    });

    await db.insert(userSubscriptions).values({ userId, tier });

    return;
  }
}

/**
 * Check if user can add more domains based on their limits.
 */
export async function canUserAddDomain(
  userId: string,
  currentCount: number,
): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  return currentCount < sub.maxDomains;
}

/**
 * Set subscription end date (user canceled but still has access until this date).
 */
export async function setSubscriptionEndsAt(
  userId: string,
  endsAt: Date,
): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({ endsAt, updatedAt: new Date() })
    .where(eq(userSubscriptions.userId, userId))
    .returning({ userId: userSubscriptions.userId });

  if (updated.length === 0) {
    throw new Error(`Subscription not found for user: ${userId}`);
  }
}

/**
 * Clear subscription end date (re-subscribed or revoked).
 * Also clears lastExpiryNotification so fresh notifications can be sent for the next cycle.
 */
export async function clearSubscriptionEndsAt(userId: string): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({
      endsAt: null,
      lastExpiryNotification: null,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId))
    .returning({ userId: userSubscriptions.userId });

  if (updated.length === 0) {
    logger.warn("subscription not found when clearing end date", { userId });
    return;
  }
}

/**
 * Create a subscription for a new user.
 * Called by better-auth database hook on user creation.
 *
 * Uses onConflictDoNothing for idempotency (handles retries/race conditions).
 * Errors are logged but not rethrown to avoid breaking user signup.
 */
export async function createSubscription(userId: string): Promise<void> {
  try {
    await db
      .insert(userSubscriptions)
      .values({ userId })
      .onConflictDoNothing({ target: userSubscriptions.userId });
  } catch (err) {
    // Log but don't rethrow - user signup should not fail due to subscription creation
    logger.error("failed to create subscription for new user", err, { userId });
  }
}

export type UserWithEndingSubscription = {
  userId: string;
  userName: string;
  userEmail: string;
  endsAt: Date;
  /** Last subscription expiry notification threshold sent (7, 3, or 1 days). Null if none sent. */
  lastExpiryNotification: number | null;
};

/**
 * Get user IDs with ending subscriptions (lightweight query for scheduler).
 * Returns only IDs for dispatching to worker functions.
 * Used by the check-subscription-expiry scheduler.
 */
export async function getUserIdsWithEndingSubscriptions(): Promise<string[]> {
  const now = new Date();

  const rows = await db
    .select({
      userId: userSubscriptions.userId,
    })
    .from(userSubscriptions)
    .where(
      and(
        isNotNull(userSubscriptions.endsAt),
        gt(userSubscriptions.endsAt, now),
      ),
    );

  return rows.map((row) => row.userId);
}

/**
 * Get user details with ending subscription.
 * Used by the check-subscription-expiry worker to fetch details for a single user.
 */
export async function getUserWithEndingSubscription(
  userId: string,
): Promise<UserWithEndingSubscription | null> {
  const now = new Date();

  const [row] = await db
    .select({
      userId: userSubscriptions.userId,
      userName: users.name,
      userEmail: users.email,
      endsAt: userSubscriptions.endsAt,
      lastExpiryNotification: userSubscriptions.lastExpiryNotification,
    })
    .from(userSubscriptions)
    .innerJoin(users, eq(userSubscriptions.userId, users.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        isNotNull(userSubscriptions.endsAt),
        gt(userSubscriptions.endsAt, now),
      ),
    )
    .limit(1);

  if (!row || row.endsAt === null) {
    return null;
  }

  return row as UserWithEndingSubscription;
}

/**
 * Get all users with ending subscriptions (canceled but still active).
 * Returns users where endsAt is set and in the future.
 * Used by the check-subscription-expiry cron job to send reminder emails.
 * @deprecated Use getUserIdsWithEndingSubscriptions and getUserWithEndingSubscription in a fan-out pattern
 */
export async function getUsersWithEndingSubscriptions(): Promise<
  UserWithEndingSubscription[]
> {
  const now = new Date();

  const rows = await db
    .select({
      userId: userSubscriptions.userId,
      userName: users.name,
      userEmail: users.email,
      endsAt: userSubscriptions.endsAt,
      lastExpiryNotification: userSubscriptions.lastExpiryNotification,
    })
    .from(userSubscriptions)
    .innerJoin(users, eq(userSubscriptions.userId, users.id))
    .where(
      and(
        isNotNull(userSubscriptions.endsAt),
        gt(userSubscriptions.endsAt, now),
      ),
    );

  // Filter out nulls (TypeScript doesn't narrow properly after isNotNull)
  return rows.filter(
    (row): row is UserWithEndingSubscription => row.endsAt !== null,
  );
}

/**
 * Update the last expiry notification threshold sent.
 * Used by the subscription expiry cron job to track which notifications have been sent.
 */
export async function setLastExpiryNotification(
  userId: string,
  threshold: number,
): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({
      lastExpiryNotification: threshold,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId))
    .returning({ userId: userSubscriptions.userId });

  if (updated.length === 0) {
    // Log but don't throw - avoid breaking the cron job for this edge case.
    // The user's subscription record should exist since we just fetched it.
    logger.warn("subscription not found when setting expiry notification", {
      userId,
      threshold,
    });
    return;
  }
}
