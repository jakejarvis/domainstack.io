import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userLimits } from "@/lib/db/schema";
import { getMaxDomainsForTier } from "@/lib/edge-config";
import { createLogger } from "@/lib/logger/server";
import type { UserTier } from "@/lib/schemas";

const logger = createLogger({ source: "user-limits" });

export type UserLimitsData = {
  userId: string;
  tier: UserTier;
  maxDomains: number;
  hasOverride: boolean;
  /** When a canceled subscription expires. Null = no pending cancellation. */
  subscriptionEndsAt: Date | null;
};

/**
 * Get or create user limits record.
 * Creates with free tier if doesn't exist.
 *
 * maxDomains is resolved in this order:
 * 1. Per-user override (if set)
 * 2. Edge Config tier limit (default)
 */
export async function getOrCreateUserLimits(
  userId: string,
): Promise<UserLimitsData> {
  // Try to find existing limits
  const existing = await db
    .select()
    .from(userLimits)
    .where(eq(userLimits.userId, userId))
    .limit(1);

  if (existing[0]) {
    // Use override if set, otherwise fetch from Edge Config
    const maxDomains =
      existing[0].maxDomainsOverride ??
      (await getMaxDomainsForTier(existing[0].tier));

    return {
      userId: existing[0].userId,
      tier: existing[0].tier,
      maxDomains,
      hasOverride: existing[0].maxDomainsOverride !== null,
      subscriptionEndsAt: existing[0].subscriptionEndsAt,
    };
  }

  // Create new limits with free tier (no override)
  try {
    const inserted = await db
      .insert(userLimits)
      .values({
        userId,
        tier: "free",
        // maxDomainsOverride left null - will use Edge Config
      })
      .returning();

    const maxDomains = await getMaxDomainsForTier("free");

    return {
      userId: inserted[0].userId,
      tier: inserted[0].tier,
      maxDomains,
      hasOverride: false,
      subscriptionEndsAt: null,
    };
  } catch (err) {
    // Handle race condition - another request may have created it
    logger.warn("race condition creating user limits, fetching again", {
      userId,
    });

    const retry = await db
      .select()
      .from(userLimits)
      .where(eq(userLimits.userId, userId))
      .limit(1);

    if (retry[0]) {
      const maxDomains =
        retry[0].maxDomainsOverride ??
        (await getMaxDomainsForTier(retry[0].tier));

      return {
        userId: retry[0].userId,
        tier: retry[0].tier,
        maxDomains,
        hasOverride: retry[0].maxDomainsOverride !== null,
        subscriptionEndsAt: retry[0].subscriptionEndsAt,
      };
    }

    // This shouldn't happen
    throw err;
  }
}

/**
 * Update user tier.
 * Clears any per-user override so they get the new tier's default limit.
 * Creates a new user_limits row if one doesn't exist.
 */
export async function updateUserTier(userId: string, tier: UserTier) {
  return await db.transaction(async (tx) => {
    // Try to update existing row
    const updated = await tx
      .update(userLimits)
      .set({
        tier,
        maxDomainsOverride: null, // Clear override on tier change
        updatedAt: new Date(),
      })
      .where(eq(userLimits.userId, userId))
      .returning();

    if (updated.length > 0) {
      logger.info("updated user tier", { userId, tier });
      return updated[0];
    }

    // No row existed, create one with the specified tier
    const inserted = await tx
      .insert(userLimits)
      .values({
        userId,
        tier,
        // maxDomainsOverride left null - will use Edge Config
      })
      .returning();

    logger.info("created user limits with tier", { userId, tier });

    return inserted[0];
  });
}

/**
 * Set a per-user domain limit override.
 * Use this for special cases like beta testers, promotions, etc.
 * Creates a new user_limits row if one doesn't exist.
 */
export async function setMaxDomainsOverride(
  userId: string,
  maxDomains: number | null,
) {
  return await db.transaction(async (tx) => {
    // Try to update existing row
    const updated = await tx
      .update(userLimits)
      .set({
        maxDomainsOverride: maxDomains,
        updatedAt: new Date(),
      })
      .where(eq(userLimits.userId, userId))
      .returning();

    if (updated.length > 0) {
      logger.info("updated max domains override", {
        userId,
        maxDomainsOverride: maxDomains,
      });
      return updated[0];
    }

    // No row existed, create one with free tier and the override
    const inserted = await tx
      .insert(userLimits)
      .values({
        userId,
        tier: "free",
        maxDomainsOverride: maxDomains,
      })
      .returning();

    logger.info("created user limits with max domains override", {
      userId,
      maxDomainsOverride: maxDomains,
    });

    return inserted[0];
  });
}

/**
 * Check if user can add more domains based on their limits.
 */
export async function canUserAddDomain(
  userId: string,
  currentCount: number,
): Promise<boolean> {
  const limits = await getOrCreateUserLimits(userId);
  return currentCount < limits.maxDomains;
}

/**
 * Set the subscription end date (when a canceled subscription expires).
 * Used when a user cancels their subscription but still has access until period end.
 *
 * Note: This should only be called for users with an existing subscription.
 * If no user_limits row exists, this logs a warning and no-ops since a user
 * without a row has never had a subscription to cancel.
 */
export async function setSubscriptionEndsAt(
  userId: string,
  endsAt: Date,
): Promise<void> {
  const updated = await db
    .update(userLimits)
    .set({
      subscriptionEndsAt: endsAt,
      updatedAt: new Date(),
    })
    .where(eq(userLimits.userId, userId))
    .returning({ userId: userLimits.userId });

  if (updated.length === 0) {
    logger.warn(
      "attempted to set subscription end date for user without limits row",
      { userId },
    );
    return;
  }

  logger.info("set subscription end date", {
    userId,
    subscriptionEndsAt: endsAt.toISOString(),
  });
}

/**
 * Clear the subscription end date (subscription is no longer pending cancellation).
 * Used when:
 * - User re-subscribes after canceling
 * - Subscription is revoked (downgrade already happened)
 *
 * Note: If no user_limits row exists, this is a no-op since there's nothing to clear.
 */
export async function clearSubscriptionEndsAt(userId: string): Promise<void> {
  const updated = await db
    .update(userLimits)
    .set({
      subscriptionEndsAt: null,
      updatedAt: new Date(),
    })
    .where(eq(userLimits.userId, userId))
    .returning({ userId: userLimits.userId });

  if (updated.length === 0) {
    logger.debug("no subscription end date to clear (user has no limits row)", {
      userId,
    });
    return;
  }

  logger.info("cleared subscription end date", { userId });
}
