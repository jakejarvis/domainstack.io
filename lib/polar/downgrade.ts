import "server-only";

import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userSubscriptions, userTrackedDomains } from "@/lib/db/schema";
import { getMaxDomainsForTier } from "@/lib/edge-config";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "polar-downgrade" });

/**
 * Handle user downgrade from Pro to Free tier.
 * Archives oldest domains that exceed the free tier limit.
 *
 * Uses a database transaction to ensure atomicity and prevent race conditions
 * where concurrent requests could cause incorrect archival counts.
 *
 * @param userId - The user ID (Polar customer ID maps to our user ID)
 * @returns The number of domains that were archived (0 if none)
 */
export async function handleDowngrade(userId: string): Promise<number> {
  // Get the free tier limit (from Edge Config, cached)
  const freeLimit = await getMaxDomainsForTier("free");

  // Use a transaction to make the entire operation atomic
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
      logger.warn("subscription not found during downgrade, creating record", {
        userId,
      });
      await tx.insert(userSubscriptions).values({ userId, tier: "free" });
    }

    logger.info("updated user tier to free", { userId });

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
      logger.debug("user within free tier limit, no archiving needed", {
        userId,
        activeCount,
        freeLimit,
      });
      return 0;
    }

    // 4. Find and archive oldest domains atomically
    const toArchive = activeCount - freeLimit;
    logger.info("archiving excess domains on downgrade", {
      userId,
      activeCount,
      freeLimit,
      toArchive,
    });

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

    const archivedCount = result.length;

    logger.info("archived domains after downgrade", {
      userId,
      archivedCount,
    });

    return archivedCount;
  });
}
