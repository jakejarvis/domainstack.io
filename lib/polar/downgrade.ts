import "server-only";

import {
  archiveOldestActiveDomains,
  countActiveTrackedDomainsForUser,
} from "@/lib/db/repos/tracked-domains";
import { updateUserTier } from "@/lib/db/repos/user-limits";
import { getMaxDomainsForTier } from "@/lib/edge-config";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "polar-downgrade" });

/**
 * Handle user downgrade from Pro to Free tier.
 * Archives oldest domains that exceed the free tier limit.
 *
 * @param userId - The user ID (Polar customer ID maps to our user ID)
 */
export async function handleDowngrade(userId: string): Promise<void> {
  // 1. Update user tier to free
  await updateUserTier(userId, "free");

  // 2. Get the free tier limit
  const freeLimit = await getMaxDomainsForTier("free");

  // 3. Count user's active (non-archived) verified domains
  const activeCount = await countActiveTrackedDomainsForUser(userId);

  // 4. If over limit, archive the oldest domains
  if (activeCount > freeLimit) {
    const toArchive = activeCount - freeLimit;
    logger.info("archiving excess domains on downgrade", {
      userId,
      activeCount,
      freeLimit,
      toArchive,
    });

    const archivedCount = await archiveOldestActiveDomains(userId, toArchive);
    logger.info("archived domains after downgrade", {
      userId,
      archivedCount,
    });
  }
}
