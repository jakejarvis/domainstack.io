import "server-only";

import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm";
import { PLAN_QUOTAS, type PLANS } from "@/lib/constants/plan-quotas";
import { db } from "@/lib/db/client";
import { userSubscriptions, users, userTrackedDomains } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "db/repos/user-subscription" });

/** Plan type derived from PLANS constant (single source of truth). */
type Plan = (typeof PLANS)[number];

export interface UserSubscriptionData {
  userId: string;
  plan: Plan;
  planQuota: number;
  endsAt: Date | null;
}

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

  const planQuota = PLAN_QUOTAS[record.tier];

  return {
    userId,
    plan: record.tier,
    planQuota,
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
  tier: Plan,
): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({ tier, updatedAt: new Date() })
    .where(eq(userSubscriptions.userId, userId))
    .returning({ userId: userSubscriptions.userId });

  if (updated.length === 0) {
    // Subscription record doesn't exist - create it with the specified tier.
    // This handles the edge case where the database hook failed during user signup.
    // Use onConflictDoUpdate to handle race conditions where another request
    // creates the record between our update check and this insert.
    logger.warn({ userId }, "subscription not found, creating missing record");

    await db
      .insert(userSubscriptions)
      .values({ userId, tier })
      .onConflictDoUpdate({
        target: userSubscriptions.userId,
        set: { tier, updatedAt: new Date() },
      });

    return;
  }
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
    logger.warn({ userId }, "subscription not found when clearing end date");
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
    logger.error({ err, userId }, "failed to create subscription for new user");
  }
}

export interface UserWithEndingSubscription {
  userId: string;
  userName: string;
  userEmail: string;
  endsAt: Date;
  /** Last subscription expiry notification threshold sent (7, 3, or 1 days). Null if none sent. */
  lastExpiryNotification: number | null;
}

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
    logger.warn(
      { userId, threshold },
      "subscription not found when setting expiry notification",
    );
    return;
  }
}

/**
 * Downgrade user from Pro to Free tier.
 * Archives oldest domains that exceed the free tier limit.
 *
 * Uses a database transaction to ensure atomicity and prevent race conditions
 * where concurrent requests could cause incorrect archival counts.
 *
 * @param userId - The user ID
 * @returns The number of domains that were archived (0 if none)
 */
export async function downgradeToFree(userId: string): Promise<number> {
  const freeLimit = PLAN_QUOTAS.free;

  return await db.transaction(async (tx) => {
    // 1. Update user tier to free within transaction
    const updated = await tx
      .update(userSubscriptions)
      .set({ tier: "free", updatedAt: new Date() })
      .where(eq(userSubscriptions.userId, userId))
      .returning({ userId: userSubscriptions.userId });

    if (updated.length === 0) {
      // Subscription record doesn't exist - create it with free tier.
      // This handles the edge case where the database hook failed during user signup.
      logger.warn(
        { userId },
        "subscription not found during downgrade, creating record",
      );
      await tx.insert(userSubscriptions).values({ userId, tier: "free" });
    }

    logger.debug({ userId }, "updated user tier to free");

    // 2. Count active domains within transaction (snapshot isolation)
    const [countResult] = await tx
      .select({ count: count() })
      .from(userTrackedDomains)
      .where(
        and(
          eq(userTrackedDomains.userId, userId),
          isNull(userTrackedDomains.archivedAt),
        ),
      );

    const activeCount = countResult?.count ?? 0;

    // 3. If within limit, nothing to archive
    if (activeCount <= freeLimit) {
      logger.debug(
        { userId, activeCount, freeLimit },
        "user within free tier limit, no archiving needed",
      );
      return 0;
    }

    // 4. Find and archive oldest domains atomically
    const toArchive = activeCount - freeLimit;
    logger.debug(
      { userId, activeCount, freeLimit, toArchive },
      "archiving excess domains on downgrade",
    );

    const domainsToArchive = await tx
      .select({ id: userTrackedDomains.id })
      .from(userTrackedDomains)
      .where(
        and(
          eq(userTrackedDomains.userId, userId),
          isNull(userTrackedDomains.archivedAt),
        ),
      )
      .orderBy(asc(userTrackedDomains.createdAt))
      .limit(toArchive);

    if (domainsToArchive.length === 0) {
      return 0;
    }

    const idsToArchive = domainsToArchive.map((d) => d.id);

    const result = await tx
      .update(userTrackedDomains)
      .set({ archivedAt: new Date() })
      .where(inArray(userTrackedDomains.id, idsToArchive))
      .returning({ id: userTrackedDomains.id });

    return result.length;
  });
}
