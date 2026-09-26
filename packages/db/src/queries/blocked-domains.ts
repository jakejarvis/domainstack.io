import { eq, inArray, notExists, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

import { hostnameWithParents } from "@domainstack/utils/domain";

import { db } from "../client";
import { blockedDomains } from "../schema";

// Shape-only reference to the per-transaction temporary staging table created in
// syncBlockedDomains below. It's not part of the app schema/migrations — Drizzle has
// no migration-free way to declare a session-scoped temp table, so its DDL is raw SQL
// — but this lets the rest of the sync use type-safe query builder methods against it.
const blocklistIncoming = pgTable("blocklist_incoming", {
  domain: text("domain").primaryKey(),
});

/**
 * Check if a domain is on the blocklist. A subdomain is blocked when it or any
 * parent up to its registrable domain is listed (`www.blocked.test` is blocked
 * by `blocked.test`), since reports now look up exact hostnames.
 * Uses primary key lookups (one per name).
 */
export async function isDomainBlocked(domain: string): Promise<boolean> {
  const rows = await db
    .select({ domain: blockedDomains.domain })
    .from(blockedDomains)
    .where(inArray(blockedDomains.domain, hostnameWithParents(domain)))
    .limit(1);

  return rows.length > 0;
}

/**
 * Sync the blocklist using upsert + delete stale approach.
 * Preserves existing entries (and their addedAt timestamps) while adding new ones
 * and removing domains no longer in the source list.
 *
 * @param domainList - Array of domain names to block
 * @returns Object with counts of domains added, kept, and removed
 */
export async function syncBlockedDomains(domainList: string[]): Promise<{
  added: number;
  removed: number;
  total: number;
}> {
  // Deduplicate and normalize
  const uniqueDomains = [...new Set(domainList.map((d) => d.toLowerCase()))];

  if (uniqueDomains.length === 0) {
    // Don't clear existing blocklist if upstream returns empty
    return { added: 0, removed: 0, total: 0 };
  }

  let addedCount = 0;
  let removedCount = 0;

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      create temporary table blocklist_incoming (domain text primary key) on commit drop
    `);

    // Stage all incoming domains in batches (temp table sidesteps the bind-parameter
    // limit that a single "WHERE domain NOT IN (...)" delete would hit at scale).
    const BATCH_SIZE = 1000;
    for (let i = 0; i < uniqueDomains.length; i += BATCH_SIZE) {
      const batch = uniqueDomains.slice(i, i + BATCH_SIZE);
      await tx
        .insert(blocklistIncoming)
        .values(batch.map((domain) => ({ domain })))
        .onConflictDoNothing();
    }

    const inserted = await tx
      .insert(blockedDomains)
      .select(
        tx
          .select({
            domain: blocklistIncoming.domain,
            addedAt: sql<Date>`now()`.as("added_at"),
          })
          .from(blocklistIncoming),
      )
      .onConflictDoNothing();
    addedCount = inserted.rowCount ?? 0;

    // Delete domains that are no longer in the source list
    const deleted = await tx
      .delete(blockedDomains)
      .where(
        notExists(
          tx
            .select({ domain: blocklistIncoming.domain })
            .from(blocklistIncoming)
            .where(eq(blocklistIncoming.domain, blockedDomains.domain)),
        ),
      );
    removedCount = deleted.rowCount ?? 0;
  });

  return {
    added: addedCount,
    removed: removedCount,
    total: uniqueDomains.length,
  };
}
