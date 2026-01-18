import "server-only";

import { eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { blockedDomains } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "blocked-domains" });

/**
 * Check if a domain is on the blocklist.
 * Uses primary key lookup for O(1) performance.
 *
 * @param domain - The domain name to check
 * @returns true if the domain is blocked
 */
export async function isDomainBlocked(domain: string): Promise<boolean> {
  const rows = await db
    .select({ domain: blockedDomains.domain })
    .from(blockedDomains)
    .where(eq(blockedDomains.domain, domain))
    .limit(1);

  return rows.length > 0;
}

/**
 * Sync the blocklist using upsert + delete stale approach.
 * Preserves existing entries (and their addedAt timestamps) while adding new ones
 * and removing domains no longer in the source list.
 *
 * @param domains - Array of domain names to block
 * @returns Object with counts of domains added, kept, and removed
 */
export async function syncBlockedDomains(domains: string[]): Promise<{
  added: number;
  removed: number;
  total: number;
}> {
  // Deduplicate and normalize
  const uniqueDomains = [...new Set(domains.map((d) => d.toLowerCase()))];

  if (uniqueDomains.length === 0) {
    // Don't clear existing blocklist if upstream returns empty, this could indicate fetch failure rather than an
    // intentional bulk deletion
    logger.warn("empty blocklist provided, skipping sync to be safe");
    return { added: 0, removed: 0, total: 0 };
  }

  let addedCount = 0;
  let removedCount = 0;

  await db.transaction(async (tx) => {
    // Upsert all domains in batches (preserves addedAt for existing entries)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < uniqueDomains.length; i += BATCH_SIZE) {
      const batch = uniqueDomains.slice(i, i + BATCH_SIZE);
      const result = await tx
        .insert(blockedDomains)
        .values(batch.map((domain) => ({ domain })))
        .onConflictDoNothing()
        .returning();

      addedCount += result.length;
    }

    // Delete domains that are no longer in the source list
    const deleted = await tx
      .delete(blockedDomains)
      .where(notInArray(blockedDomains.domain, uniqueDomains))
      .returning();

    removedCount = deleted.length;
  });

  logger.debug(
    { added: addedCount, removed: removedCount, total: uniqueDomains.length },
    "blocklist sync complete",
  );

  return {
    added: addedCount,
    removed: removedCount,
    total: uniqueDomains.length,
  };
}
