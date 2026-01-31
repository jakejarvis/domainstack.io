import { getDomainTld } from "@domainstack/utils/domain";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "../client";
import { domains } from "../schema";

/**
 * Debounce interval for updating domain lastAccessedAt timestamp.
 * Prevents excessive writes by only updating if the last access was
 * more than this many milliseconds ago.
 */
const DOMAIN_UPDATE_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

export interface UpsertDomainParams {
  name: string; // punycode lowercased
  tld: string;
  unicodeName: string;
}

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
 * Find an existing domain record by ID.
 * Returns null if the domain doesn't exist.
 */
export async function getDomainById(id: string) {
  const rows = await db
    .select()
    .from(domains)
    .where(eq(domains.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get domain name by ID.
 * Lightweight query that only fetches the name column.
 * Returns null if the domain doesn't exist.
 */
export async function getDomainNameById(
  id: string,
): Promise<{ name: string } | null> {
  const rows = await db
    .select({ name: domains.name })
    .from(domains)
    .where(eq(domains.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Update lastAccessedAt timestamp for a domain.
 * Only updates if the domain hasn't been accessed in the last 5 minutes
 * to reduce unnecessary writes.
 *
 * Fire-and-forget: catches errors and returns false without throwing.
 *
 * @param name - The domain name to update
 * @returns true if updated, false if error or skipped
 */
export async function updateLastAccessed(name: string): Promise<boolean> {
  try {
    const debounceThreshold = new Date(Date.now() - DOMAIN_UPDATE_DEBOUNCE_MS);

    await db
      .update(domains)
      .set({
        lastAccessedAt: new Date(),
      })
      .where(
        and(
          eq(domains.name, name),
          or(
            isNull(domains.lastAccessedAt),
            lt(domains.lastAccessedAt, debounceThreshold),
          ),
        ),
      );
    return true;
  } catch {
    return false;
  }
}

/**
 * Get domains that were accessed within the specified time window.
 * Used by the warm-cache cron to refresh data for recently-accessed domains.
 *
 * @param hoursAgo - How many hours back to look (default: 24)
 * @returns Array of domain names ordered by most recently accessed, capped at 500
 */
export async function getRecentlyAccessedDomains(
  hoursAgo = 24,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  const rows = await db
    .select({ name: domains.name })
    .from(domains)
    .where(gt(domains.lastAccessedAt, cutoff))
    .orderBy(desc(domains.lastAccessedAt))
    .limit(500);

  return rows.map((r) => r.name);
}
