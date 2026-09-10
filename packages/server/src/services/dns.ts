/**
 * DNS service - fetches and persists DNS records.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * All errors throw (for TanStack Query to retry) - there are no permanent failures.
 */

import { DNS_RECORD_TYPES } from "@domainstack/constants";
import { replaceDns } from "@domainstack/db/queries/dns";
import { ensureDomainRecord } from "@domainstack/db/queries/domains";
import type { DnsRecordType, DnsRecordsResponse } from "@domainstack/types";

import { DnsProviderError, type DnsFetchData, fetchDnsRecords } from "../dns";
import { RemoteDataUnavailableError } from "./fetch-errors";

// ============================================================================
// Types
// ============================================================================

export type DnsResult = { success: true; data: DnsRecordsResponse };

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch and persist DNS records for a domain.
 *
 * @param domain - The domain to look up
 * @returns DNS result with records
 *
 * @throws Error on all failures - TanStack Query retries these
 */
export async function fetchDns(domain: string): Promise<DnsResult> {
  // 1. Fetch from DoH providers (throws DnsProviderError on failure)
  let fetchData: DnsFetchData;
  try {
    fetchData = await fetchDnsRecords(domain);
  } catch (err) {
    if (err instanceof DnsProviderError) {
      throw new RemoteDataUnavailableError("DNS data unavailable", { cause: err });
    }
    throw err;
  }

  // 2. Persist to database
  await persistDnsRecords(domain, fetchData);

  return {
    success: true,
    data: {
      records: fetchData.records,
      resolver: fetchData.resolver,
    },
  };
}

// ============================================================================
// Internal: Persist DNS Records
// ============================================================================

async function persistDnsRecords(domain: string, fetchData: DnsFetchData): Promise<void> {
  const types = DNS_RECORD_TYPES;
  const now = new Date();

  const domainRecord = await ensureDomainRecord(domain);

  type PersistDnsRecord = {
    name: string;
    value: string;
    ttl: number | undefined;
    priority: number | undefined;
    isCloudflare: boolean | undefined;
    expiresAt: Date;
  };

  const recordsByType = Object.fromEntries(
    types.map((t) => [t, [] as PersistDnsRecord[]]),
  ) as Record<DnsRecordType, PersistDnsRecord[]>;

  for (const r of fetchData.recordsWithExpiry) {
    recordsByType[r.type].push({
      name: r.name,
      value: r.value,
      ttl: r.ttl,
      priority: r.priority,
      isCloudflare: r.isCloudflare,
      expiresAt: new Date(r.expiresAt),
    });
  }

  await replaceDns({
    domainId: domainRecord.id,
    resolver: fetchData.resolver,
    fetchedAt: now,
    recordsByType,
  });
}
