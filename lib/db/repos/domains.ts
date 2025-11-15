import "server-only";

import { eq, inArray, sql } from "drizzle-orm";
import { getDomainTld } from "rdapper";
import { db } from "@/lib/db/client";
import { domains } from "@/lib/db/schema";

export type UpsertDomainParams = {
  name: string; // punycode lowercased
  tld: string;
  unicodeName: string;
};

/**
 * Insert a new domain record or return the existing one if it already exists.
 * Used when persisting data for a registered domain.
 */
export async function upsertDomain(params: UpsertDomainParams) {
  const { name, tld, unicodeName } = params;

  const inserted = await db
    .insert(domains)
    .values({ name, tld, unicodeName })
    .onConflictDoUpdate({
      target: [domains.name],
      set: { tld, unicodeName, updatedAt: new Date() },
    })
    .returning();

  return inserted[0];
}

/**
 * Find an existing domain record by name.
 * Returns null if the domain doesn't exist (typically means unregistered).
 */
export async function findDomainByName(name: string) {
  const rows = await db
    .select()
    .from(domains)
    .where(eq(domains.name, name))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Parse domain name and ensure a domain record exists in Postgres.
 * This is used by services that need to persist data for a domain (favicon, screenshot, etc.)
 * even when a full domain report hasn't been requested.
 *
 * @param domain - The domain name (should already be normalized/registrable)
 * @returns The domain record with its ID
 */
export async function ensureDomainRecord(domain: string) {
  const tld = getDomainTld(domain) ?? "";

  // For unicode handling, we'd need to use toUnicode from node:url or a library,
  // but for now we'll use the ASCII version as the unicode name if they match
  // This is safe because rdapper already normalizes to ASCII/punycode when needed
  const unicodeName = domain;

  const domainRecord = await upsertDomain({
    name: domain,
    tld,
    unicodeName,
  });

  return domainRecord;
}

/**
 * Batch update lastAccessedAt timestamps for multiple domains.
 * Used by the access sync cron to flush Redis data to Postgres.
 *
 * @param updates - Array of domain names and their access timestamps
 */
export async function batchUpdateLastAccessed(
  updates: Array<{ name: string; accessedAt: Date }>,
): Promise<void> {
  if (updates.length === 0) return;

  // Use Drizzle's update with case-when pattern for batch updates
  // This is more efficient than individual updates
  const cases = updates.map(
    (u) =>
      sql`WHEN ${domains.name} = ${u.name} THEN ${u.accessedAt.toISOString()}::timestamptz`,
  );

  const names = updates.map((u) => u.name);

  await db
    .update(domains)
    .set({
      lastAccessedAt: sql`CASE ${sql.join(cases, sql.raw(" "))} END`,
      updatedAt: new Date(),
    })
    .where(inArray(domains.name, names));
}
