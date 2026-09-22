import type { InferInsertModel } from "drizzle-orm";
import { eq, inArray, sql } from "drizzle-orm";

import { DNS_RECORD_TYPES } from "@domainstack/constants";
import type { DnsRecord, DnsRecordsResponse, DnssecResult } from "@domainstack/types";
import {
  deduplicateDnsRecords,
  makeDnsRecordKey,
  sortDnsRecordsByType,
  withRegistryCheck,
} from "@domainstack/utils/dns";

import { db } from "../client";
import { dnsRecords, type dnsRecordType, dnssecChecks, domains, registrations } from "../schema";
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
  /** DNSSEC observation stored alongside the records (without the response-time `registry` check). */
  dnssec?: {
    result: DnssecResult;
    expiresAt: Date;
    /** False means this round's `result.ds`/`result.dnskeys` is a stand-in for a failed query, not a confirmed-empty set — the corresponding stored column is preserved instead of overwritten. */
    dsAvailable: boolean;
    dnskeysAvailable: boolean;
  };
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

    if (params.dnssec) {
      const { result, expiresAt, dsAvailable, dnskeysAvailable } = params.dnssec;
      const base = { resolver: params.resolver, fetchedAt: params.fetchedAt, expiresAt };

      if (result.status === "indeterminate") {
        // A failed/incomplete observation. Never overwrite a prior good status
        // with "could not tell" (and never fabricate a DS/DNSKEY set from it),
        // but still bump fetchedAt/expiresAt: leaving them frozen would make
        // the row (and per `getCachedDns`, the whole DNS cache) permanently
        // stale, forcing a full refetch on every request until DNSSEC happens
        // to succeed again. The first-ever observation has no prior status to
        // preserve, so it's inserted as indeterminate — an honest "unknown".
        await tx
          .insert(dnssecChecks)
          .values({
            domainId,
            status: "indeterminate",
            ds: [],
            dnskeys: [],
            dsAvailable: false,
            dnskeysAvailable: false,
            ...base,
          })
          .onConflictDoUpdate({ target: dnssecChecks.domainId, set: base });
      } else {
        // The overall status is determinate (from the SOA query), but the DS
        // and/or DNSKEY queries are independent and each may have failed on
        // their own — an unavailable one contributes an empty array to
        // `result` that must not be read as a confirmed-empty set, even on a
        // first-ever row (which is why `dsAvailable`/`dnskeysAvailable` are
        // stored too, not just used to decide what to overwrite). Update only
        // touches the columns whose query actually succeeded, so a previously
        // real set (and its availability) survives an unavailable round.
        const insertValues = {
          status: result.status,
          ds: result.ds,
          dnskeys: result.dnskeys,
          dsAvailable,
          dnskeysAvailable,
          ...base,
        };
        const updateSet = {
          status: result.status,
          ...base,
          ...(dsAvailable ? { ds: result.ds, dsAvailable: true } : {}),
          ...(dnskeysAvailable ? { dnskeys: result.dnskeys, dnskeysAvailable: true } : {}),
        };
        await tx
          .insert(dnssecChecks)
          .values({ domainId, ...insertValues })
          .onConflictDoUpdate({ target: dnssecChecks.domainId, set: updateSet });
      }
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
      dnssecStatus: dnssecChecks.status,
      dnssecDs: dnssecChecks.ds,
      dnssecKeys: dnssecChecks.dnskeys,
      dnssecDsAvailable: dnssecChecks.dsAvailable,
      dnssecDnskeysAvailable: dnssecChecks.dnskeysAvailable,
      dnssecFetchedAt: dnssecChecks.fetchedAt,
      dnssecExpiresAt: dnssecChecks.expiresAt,
      registryDnssec: registrations.dnssec,
    })
    .from(domains)
    .innerJoin(dnsRecords, eq(dnsRecords.domainId, domains.id))
    .leftJoin(dnssecChecks, eq(dnssecChecks.domainId, domains.id))
    .leftJoin(registrations, eq(registrations.domainId, domains.id))
    .where(eq(domains.name, domain));

  // Records are stored per row, so a lookup that found none leaves nothing to
  // carry its freshness: an empty answer reads as a cache miss and is refetched
  // (and metered) each time. Accepted because a registered domain with none of
  // the probed record types is rare; caching it would need a schema change.
  if (rows.length === 0) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  // Every row repeats the same (at most one) DNSSEC observation.
  const first = rows[0];
  const dnssecCheck =
    first?.dnssecStatus && first.dnssecFetchedAt && first.dnssecExpiresAt
      ? {
          status: first.dnssecStatus,
          ds: first.dnssecDs ?? [],
          dnskeys: first.dnssecKeys ?? [],
          dsAvailable: first.dnssecDsAvailable ?? false,
          dnskeysAvailable: first.dnssecDnskeysAvailable ?? false,
          fetchedAt: first.dnssecFetchedAt,
          expiresAt: first.dnssecExpiresAt,
        }
      : null;

  // Earliest fetch and expiry across the records and the DNSSEC observation
  const fetchedAts = rows.map((r) => r.fetchedAt);
  const expiresAts = rows.map((r) => r.expiresAt);
  if (dnssecCheck) {
    fetchedAts.push(dnssecCheck.fetchedAt);
    expiresAts.push(dnssecCheck.expiresAt);
  }
  const earliest = (dates: Array<Date | null>) =>
    dates.reduce<Date | null>((min, d) => (d && (!min || d < min) ? d : min), null);
  const earliestFetchedAt = earliest(fetchedAts);
  const earliestExpiresAt = earliest(expiresAts);

  // Stale if ANY part is stale (if one is stale, we should revalidate all). A
  // domain cached before DNSSEC tracking has no observation yet, so it is
  // stale until the next fetch records one.
  const stale = !dnssecCheck || expiresAts.some((d) => (d?.getTime?.() ?? 0) <= nowMs);

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
      dnssec: dnssecCheck
        ? withRegistryCheck(
            {
              status: dnssecCheck.status,
              ds: dnssecCheck.ds,
              dnskeys: dnssecCheck.dnskeys,
              ...(dnssecCheck.dnskeysAvailable ? {} : { dnskeysAvailable: false }),
            },
            first?.registryDnssec,
            { dsAvailable: dnssecCheck.dsAvailable },
          )
        : undefined,
    },
    stale,
    fetchedAt: earliestFetchedAt,
    expiresAt: earliestExpiresAt,
  };
}
