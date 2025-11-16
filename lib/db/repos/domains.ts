import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDomainTld } from "rdapper";
import { db } from "@/lib/db/client";
import { domains } from "@/lib/db/schema";

/**
 * Debounce interval for updating domain lastAccessedAt timestamp.
 * Prevents excessive writes by only updating if the last access was
 * more than this many milliseconds ago.
 */
const DOMAIN_UPDATE_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

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
 * @throws {Error} If the domain has no valid TLD
 */
export async function ensureDomainRecord(domain: string) {
  const tld = getDomainTld(domain);

  if (!tld) {
    throw new Error(`Cannot persist domain "${domain}": unable to extract TLD`);
  }

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
 * Update lastAccessedAt timestamp for a domain.
 * Only updates if the domain hasn't been accessed in the last 5 minutes
 * to reduce unnecessary writes.
 *
 * Fire-and-forget: catches errors and logs warnings without throwing.
 *
 * @param name - The domain name to update
 */
export async function updateLastAccessed(name: string): Promise<void> {
  try {
    const debounceThreshold = new Date(Date.now() - DOMAIN_UPDATE_DEBOUNCE_MS);

    await db
      .update(domains)
      .set({
        lastAccessedAt: new Date(),
      })
      .where(
        sql`${domains.name} = ${name} AND (${domains.lastAccessedAt} IS NULL OR ${domains.lastAccessedAt} < ${debounceThreshold})`,
      );
  } catch (err) {
    console.warn(
      `[access] failed to update lastAccessedAt for ${name}`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
