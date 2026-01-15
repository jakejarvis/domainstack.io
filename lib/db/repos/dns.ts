import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { eq, inArray, sql } from "drizzle-orm";
import type { DnsRecordType } from "@/lib/constants/dns";
import { DNS_RECORD_TYPES } from "@/lib/constants/dns";
import { db } from "@/lib/db/client";
import { dnsRecords, type dnsRecordType, domains } from "@/lib/db/schema";
import { deduplicateDnsRecords, makeDnsRecordKey } from "@/lib/dns-utils";
import type { DnsRecord, DnsRecordsResponse } from "@/lib/types/domain/dns";
import type { CacheResult } from "./types";

type DnsRecordInsert = InferInsertModel<typeof dnsRecords>;

export interface UpsertDnsParams {
  domainId: string;
  resolver: string;
  fetchedAt: Date;
  // complete set per type
  recordsByType: Record<
    (typeof dnsRecordType.enumValues)[number],
    Array<
      Omit<
        DnsRecordInsert,
        "id" | "domainId" | "type" | "resolver" | "fetchedAt"
      >
    >
  >;
}

export async function replaceDns(params: UpsertDnsParams) {
  const { domainId, recordsByType } = params;

  // Atomic delete and upsert in a single transaction to ensure data consistency
  await db.transaction(async (tx) => {
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
        ...r,
        type,
        // Always normalize name (hostname) to lowercase
        name: (r.name as string).trim().toLowerCase(),
        // Normalize value to lowercase except for TXT records
        value: preserveValueCase
          ? (r.value as string).trim()
          : (r.value as string).trim().toLowerCase(),
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
    const idsToDelete = allExisting
      .filter((e) => {
        const key = makeDnsRecordKey(e.type, e.name, e.value, e.priority);
        return !allNextKeys.has(key);
      })
      .map((e) => e.id);

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
 * external DNS providers, use `fetchDnsRecordsStep` from workflows/shared/dns.
 *
 * Optimized: Uses a single query with JOIN to fetch domain and DNS records,
 * reducing from 2 round trips to 1.
 */
export async function getCachedDns(
  domain: string,
): Promise<CacheResult<DnsRecordsResponse>> {
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
      expiresAt: dnsRecords.expiresAt,
    })
    .from(domains)
    .innerJoin(dnsRecords, eq(dnsRecords.domainId, domains.id))
    .where(eq(domains.name, domain));

  if (rows.length === 0) {
    return { data: null, stale: false, expiresAt: null };
  }

  // Find the earliest expiration across all records
  const earliestExpiresAt = rows.reduce<Date | null>((earliest, r) => {
    if (!r.expiresAt) return earliest;
    if (!earliest) return r.expiresAt;
    return r.expiresAt < earliest ? r.expiresAt : earliest;
  }, null);

  // Check if ANY record is stale (if one is stale, we should revalidate all)
  const stale = rows.some((r) => (r.expiresAt?.getTime?.() ?? 0) <= nowMs);

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
    expiresAt: earliestExpiresAt,
  };
}

// Helper functions for getDns

function sortDnsRecordsByType(
  records: DnsRecord[],
  order: readonly DnsRecordType[],
): DnsRecord[] {
  const byType: Record<DnsRecordType, DnsRecord[]> = {
    A: [],
    AAAA: [],
    MX: [],
    TXT: [],
    NS: [],
  };
  for (const r of records) byType[r.type].push(r);

  const sorted: DnsRecord[] = [];
  for (const t of order) {
    sorted.push(...sortDnsRecordsForType(byType[t], t));
  }
  return sorted;
}

function sortDnsRecordsForType(
  arr: DnsRecord[],
  type: DnsRecordType,
): DnsRecord[] {
  if (type === "MX") {
    arr.sort((a, b) => {
      const ap = a.priority ?? Number.MAX_SAFE_INTEGER;
      const bp = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.value.localeCompare(b.value);
    });
    return arr;
  }
  arr.sort((a, b) => a.value.localeCompare(b.value));
  return arr;
}
