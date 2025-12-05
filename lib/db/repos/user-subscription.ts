import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userSubscriptions } from "@/lib/db/schema";
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
  const sub = await db
    .select({
      userId: userSubscriptions.userId,
      tier: userSubscriptions.tier,
      endsAt: userSubscriptions.endsAt,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  const record = sub[0];
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
    throw new Error(`Subscription not found for user: ${userId}`);
  }

  logger.info("updated user tier", { userId, tier });
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

  logger.info("set subscription end date", {
    userId,
    endsAt: endsAt.toISOString(),
  });
}

/**
 * Clear subscription end date (re-subscribed or revoked).
 */
export async function clearSubscriptionEndsAt(userId: string): Promise<void> {
  const updated = await db
    .update(userSubscriptions)
    .set({ endsAt: null, updatedAt: new Date() })
    .where(eq(userSubscriptions.userId, userId))
    .returning({ userId: userSubscriptions.userId });

  if (updated.length === 0) {
    logger.warn("subscription not found when clearing end date", { userId });
    return;
  }

  logger.info("cleared subscription end date", { userId });
}

/**
 * Create a subscription for a new user.
 * Called by better-auth database hook on user creation.
 */
export async function createSubscription(userId: string): Promise<void> {
  await db.insert(userSubscriptions).values({ userId });
  logger.debug("created subscription for new user", { userId });
}
