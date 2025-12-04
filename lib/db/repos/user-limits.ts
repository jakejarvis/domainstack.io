import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userLimits, type userTier } from "@/lib/db/schema";
import { getMaxDomainsForTier } from "@/lib/edge-config";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "user-limits" });

export type UserTier = (typeof userTier.enumValues)[number];

export type UserLimitsData = {
  userId: string;
  tier: UserTier;
  maxDomains: number;
  hasOverride: boolean;
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
      };
    }

    // This shouldn't happen
    throw err;
  }
}

/**
 * Update user tier.
 * Clears any per-user override so they get the new tier's default limit.
 */
export async function updateUserTier(userId: string, tier: UserTier) {
  const updated = await db
    .update(userLimits)
    .set({
      tier,
      maxDomainsOverride: null, // Clear override on tier change
      updatedAt: new Date(),
    })
    .where(eq(userLimits.userId, userId))
    .returning();

  return updated[0];
}

/**
 * Set a per-user domain limit override.
 * Use this for special cases like beta testers, promotions, etc.
 */
export async function setMaxDomainsOverride(
  userId: string,
  maxDomains: number | null,
) {
  const updated = await db
    .update(userLimits)
    .set({
      maxDomainsOverride: maxDomains,
      updatedAt: new Date(),
    })
    .where(eq(userLimits.userId, userId))
    .returning();

  logger.info("set max domains override", {
    userId,
    maxDomainsOverride: maxDomains,
  });

  return updated[0];
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
