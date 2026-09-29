import type { InferInsertModel } from "drizzle-orm";
import { eq, inArray, sql } from "drizzle-orm";

import { DNS_RECORD_TYPES } from "@domainstack/constants";
import type { DnsRecord, DnsRecordsResponse } from "@domainstack/types";
import {
  deduplicateDnsRecords,
  makeDnsRecordKey,
  sortDnsRecordsByType,
} from "@domainstack/utils/dns";

import { db } from "../client";
import { dnsRecords, type dnsRecordType, domains } from "../schema";
import type { CacheResult } from "../types";

type DnsRecordInsert = InferInsertModel<typeof dnsRecords>;

export interface UpsertDnsParams {
  domainId: string;
  resolver: string;
  fetchedAt: Date;
  // complete set per type
  recordsByType: Record<
    (typeof dnsRecordType.enumValues)[number],
    Array<Omit<DnsRecordInsert, "id" | "domainId" | "type" | "resolver" | "fetchedAt">>
  >;
}

export async function replaceDns(params: UpsertDnsParams) {
  const { domainId, recordsByType } = params;

  // Atomic delete and upsert in a single transaction to ensure data consistency
  await db.transaction(async (tx) => {
    // Serialize complete-set replacements per domain. A transaction alone gives
    // atomicity, not isolation: two concurrent replacements could both read the
    // same old set, then interleave deletes and upserts and leave a union (or stale
    // values) instead of either complete observation. The in-process `shareInFlight`
    // cannot help across serverless instances, so the database is the mutex.
    //
    // The parent `domains` row is the lock key because it is the one stable row every
    // replacement for this domain shares. Locking `dns_records` rows would not work:
    // when the old or new complete set is empty there is nothing to lock.
    //
    // `FOR NO KEY UPDATE` (not `FOR UPDATE`) still conflicts with itself, so two
    // replacements for one domain queue up, but it does not conflict with the
    // `FOR KEY SHARE` lock Postgres takes for foreign-key checks when other sections
    // (registrations, certificates, headers, ...) insert rows for this domain, so
    // those writes are not stalled while DNS replaces. Other domains stay concurrent.
    // This MUST stay the first query, before any read of `dns_records`.
    const [lockedDomain] = await tx
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.id, domainId))
      .for("no key update");

    if (!lockedDomain) {
      // Invariant violation: callers obtain `domainId` from ensureDomainRecord first.
      throw new Error(`Cannot replace DNS records: domain ${domainId} does not exist`);
    }

    // Fetch all existing records for all types in a single query
    const allExisting = await tx
      .select({
        id: dnsRecords.id,
        type: dnsRecords.type,
        name: dnsRecords.name,
        value: dnsRecords.value,
        priority: dnsRecords.priority,
      })
      .from(dnsRecords)
      .where(eq(dnsRecords.domainId, domainId));

    // Collect all records to upsert
    const allRecordsToUpsert: DnsRecordInsert[] = [];

    const allNextKeys = new Set<string>();

    for (const type of Object.keys(recordsByType) as Array<
      (typeof dnsRecordType.enumValues)[number]
    >) {
      // TXT records preserve case (e.g., verification tokens like google-site-verification)
      // All other record types normalize to lowercase for consistent storage.
      // Hostnames are case-insensitive per RFC 1035; IP addresses have no case.
      const preserveValueCase = type === "TXT";

      const next = (recordsByType[type] ?? []).map((r) => ({
        type,
        // Always normalize name (hostname) to lowercase
        name: r.name.trim().toLowerCase(),
        // Normalize value to lowercase except for TXT records
        value: preserveValueCase ? r.value.trim() : r.value.trim().toLowerCase(),
        ttl: r.ttl,
        priority: r.priority,
        isCloudflare: r.isCloudflare,
        expiresAt: r.expiresAt,
      }));

      for (const r of next) {
        // Values are already normalized above, so we can pass them directly.
        // makeDnsRecordKey handles the TXT case-sensitivity logic.
        const key = makeDnsRecordKey(type, r.name, r.value, r.priority ?? null);

        // Skip duplicates within the same batch
        if (allNextKeys.has(key)) {
          continue;
        }

        allNextKeys.add(key);

        allRecordsToUpsert.push({
          domainId,
          type,
          name: r.name,
          value: r.value,
          ttl: r.ttl ?? null,
          priority: r.priority ?? null,
          isCloudflare: r.isCloudflare ?? null,
          resolver: params.resolver,
          fetchedAt: params.fetchedAt,
          expiresAt: r.expiresAt,
        });
      }
    }

    // Identify records to delete (exist in DB but not in the new set)
    const idsToDelete = allExisting.reduce<string[]>((acc, e) => {
      const key = makeDnsRecordKey(e.type, e.name, e.value, e.priority);
      if (!allNextKeys.has(key)) {
        acc.push(e.id);
      }
      return acc;
    }, []);

    // Delete obsolete records
    if (idsToDelete.length > 0) {
      await tx.delete(dnsRecords).where(inArray(dnsRecords.id, idsToDelete));
    }

    // Batch upsert all records
    if (allRecordsToUpsert.length > 0) {
      await tx
        .insert(dnsRecords)
        .values(allRecordsToUpsert)
        .onConflictDoUpdate({
          target: [
            dnsRecords.domainId,
            dnsRecords.type,
            dnsRecords.name,
            dnsRecords.value,
            dnsRecords.priority,
          ],
          set: {
            ttl: sql`excluded.${sql.identifier(dnsRecords.ttl.name)}`,
            isCloudflare: sql`excluded.${sql.identifier(dnsRecords.isCloudflare.name)}`,
            resolver: sql`excluded.${sql.identifier(dnsRecords.resolver.name)}`,
            fetchedAt: sql`excluded.${sql.identifier(dnsRecords.fetchedAt.name)}`,
            expiresAt: sql`excluded.${sql.identifier(dnsRecords.expiresAt.name)}`,
          },
        });
    }
  });
}

/**
 * Get cached DNS records for a domain with staleness metadata.
 * Returns data even if expired, with `stale: true` flag.
 *
 * Note: This queries the database cache. For fetching fresh data from
 * external DNS providers, use `lookupSection` / `fetchSection` from `@domainstack/core/lookup`.
 *
 * Optimized: Uses a single query with JOIN to fetch domain and DNS records,
 * reducing from 2 round trips to 1.
 */
export async function getCachedDns(domain: string): Promise<CacheResult<DnsRecordsResponse>> {
  const nowMs = Date.now();
  const types = DNS_RECORD_TYPES;

  // Single query: JOIN domains -> dnsRecords
  const rows = await db
    .select({
      type: dnsRecords.type,
      name: dnsRecords.name,
      value: dnsRecords.value,
      ttl: dnsRecords.ttl,
      priority: dnsRecords.priority,
      isCloudflare: dnsRecords.isCloudflare,
      resolver: dnsRecords.resolver,
      fetchedAt: dnsRecords.fetchedAt,
      expiresAt: dnsRecords.expiresAt,
    })
    .from(domains)
    .innerJoin(dnsRecords, eq(dnsRecords.domainId, domains.id))
    .where(eq(domains.name, domain));

  // Records are stored per row, so a lookup that found none leaves nothing to
  // carry its freshness: an empty answer reads as a cache miss and is refetched
  // (and metered) each time. Accepted because a registered domain with none of
  // the probed record types is rare; caching it would need a schema change.
  if (rows.length === 0) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  // Find the earliest fetchedAt (oldest data) across all records
  const earliestFetchedAt = rows.reduce<Date | null>((earliest, r) => {
    if (!r.fetchedAt) return earliest;
    if (!earliest) return r.fetchedAt;
    return r.fetchedAt < earliest ? r.fetchedAt : earliest;
  }, null);

  // Find the earliest expiration across all records
  const earliestExpiresAt = rows.reduce<Date | null>((earliest, r) => {
    if (!r.expiresAt) return earliest;
    if (!earliest) return r.expiresAt;
    return r.expiresAt < earliest ? r.expiresAt : earliest;
  }, null);

  // Check if ANY record is stale (if one is stale, we should revalidate all)
  const stale = rows.some((r) => r.expiresAt.getTime() <= nowMs);

  // Assemble cached records
  const records: DnsRecord[] = rows.map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    ttl: r.ttl ?? undefined,
    priority: r.priority ?? undefined,
    isCloudflare: r.isCloudflare ?? undefined,
  }));

  // Deduplicate and sort
  const deduplicated = deduplicateDnsRecords(records);
  const sorted = sortDnsRecordsByType(deduplicated, types);

  return {
    data: {
      records: sorted,
      resolver: rows[0]?.resolver ?? null,
    },
    stale,
    fetchedAt: earliestFetchedAt,
    expiresAt: earliestExpiresAt,
  };
}
