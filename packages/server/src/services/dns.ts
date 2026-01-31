/**
 * DNS service - fetches and persists DNS records.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * All errors throw (for TanStack Query to retry) - there are no permanent failures.
 */

import type { DnsRecordType } from "@domainstack/constants";
import type { DnsRecord, DnsRecordsResponse } from "@domainstack/types";
import { ttlForDnsRecord } from "../ttl";

// ============================================================================
// Types
// ============================================================================

export type DnsResult = { success: true; data: DnsRecordsResponse };

interface DnsFetchData {
  records: DnsRecord[];
  resolver: string;
  recordsWithExpiry: Array<{
    type: string;
    name: string;
    value: string;
    ttl?: number;
    priority?: number;
    isCloudflare?: boolean;
    expiresAt: string;
  }>;
}

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
  // 1. Fetch from DoH providers
  const fetchData = await fetchDnsRecords(domain);

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
// Internal: Fetch DNS Records
// ============================================================================

async function fetchDnsRecords(domain: string): Promise<DnsFetchData> {
  const { isCloudflareIp } = await import("../cloudflare");
  const { DNS_TYPE_NUMBERS, DNS_RECORD_TYPES } = await import(
    "@domainstack/constants"
  );
  const {
    deduplicateDnsRecords,
    providerOrderForLookup,
    queryDohProvider,
    sortDnsRecordsByType,
  } = await import("@domainstack/utils/dns");

  const providers = providerOrderForLookup(domain);
  const types = DNS_RECORD_TYPES;
  const now = new Date();

  for (const provider of providers) {
    try {
      const results = await Promise.all(
        types.map(async (type) => {
          const answers = await queryDohProvider(provider, domain, type);

          const records: DnsRecord[] = [];
          for (const a of answers) {
            const expectedTypeNumber = DNS_TYPE_NUMBERS[type];
            if (a.type !== expectedTypeNumber) continue;

            const name = a.name.endsWith(".") ? a.name.slice(0, -1) : a.name;
            const ttl = a.TTL;

            switch (type) {
              case "A":
              case "AAAA": {
                const value = a.data.endsWith(".")
                  ? a.data.slice(0, -1)
                  : a.data;
                const isCloudflare = await isCloudflareIp(value);
                records.push({ type, name, value, ttl, isCloudflare });
                break;
              }
              case "NS": {
                const value = a.data.endsWith(".")
                  ? a.data.slice(0, -1)
                  : a.data;
                records.push({ type, name, value, ttl });
                break;
              }
              case "TXT": {
                const value = a.data.replace(/^"|"$/g, "");
                records.push({ type, name, value, ttl });
                break;
              }
              case "MX": {
                const [prioStr, ...hostParts] = a.data.split(" ");
                const priority = Number(prioStr);
                let host = hostParts.join(" ");
                host = host.endsWith(".") ? host.slice(0, -1) : host;
                if (!host) continue;
                records.push({
                  type,
                  name,
                  value: host,
                  ttl,
                  priority: Number.isFinite(priority) ? priority : 0,
                });
                break;
              }
            }
          }
          return records;
        }),
      );

      const flat = results.flat();
      const deduplicated = deduplicateDnsRecords(flat);
      const sorted = sortDnsRecordsByType(deduplicated, types);

      const recordsWithExpiry = deduplicated.map((r) => ({
        type: r.type,
        name: r.name,
        value: r.value,
        ttl: r.ttl ?? undefined,
        priority: r.priority ?? undefined,
        isCloudflare: r.isCloudflare ?? undefined,
        expiresAt: ttlForDnsRecord(now, r.ttl ?? undefined).toISOString(),
      }));

      return {
        records: sorted,
        resolver: provider.key,
        recordsWithExpiry,
      };
    } catch {
      // Try next provider
    }
  }

  // All providers failed
  throw new Error("All DoH providers failed");
}

// ============================================================================
// Internal: Persist DNS Records
// ============================================================================

async function persistDnsRecords(
  domain: string,
  fetchData: DnsFetchData,
): Promise<void> {
  const { DNS_RECORD_TYPES } = await import("@domainstack/constants");
  const { ensureDomainRecord, replaceDns } = await import(
    "@domainstack/db/queries"
  );

  const types = DNS_RECORD_TYPES;
  const now = new Date();

  const domainRecord = await ensureDomainRecord(domain);

  const recordsByType = Object.fromEntries(
    types.map((t) => [
      t,
      fetchData.recordsWithExpiry
        .filter((r) => r.type === t)
        .map((r) => ({
          name: r.name,
          value: r.value,
          ttl: r.ttl,
          priority: r.priority,
          isCloudflare: r.isCloudflare,
          expiresAt: new Date(r.expiresAt),
        })),
    ]),
  ) as Record<
    DnsRecordType,
    Array<{
      name: string;
      value: string;
      ttl: number | undefined;
      priority: number | undefined;
      isCloudflare: boolean | undefined;
      expiresAt: Date;
    }>
  >;

  await replaceDns({
    domainId: domainRecord.id,
    resolver: fetchData.resolver,
    fetchedAt: now,
    recordsByType,
  });
}
