/**
 * DNS fetch step.
 *
 * Fetches DNS records from DoH providers with fallback.
 * This step is shared between the dedicated dnsWorkflow and internal workflows.
 */

import { RetryableError } from "workflow";
import type { DnsRecordType } from "@/lib/constants/dns";
import type { DnsRecord } from "@/lib/types/domain/dns";
import type { FetchDnsResult } from "./types";

/**
 * Step: Fetch DNS records from DoH providers with fallback.
 *
 * @param domain - The domain to resolve
 * @returns FetchDnsResult with typed error on failure
 */
export async function fetchDnsRecordsStep(
  domain: string,
): Promise<FetchDnsResult> {
  "use step";

  // Dynamic imports for Node.js modules
  const { isCloudflareIp } = await import("@/lib/cloudflare");
  const { DNS_RECORD_TYPES } = await import("@/lib/constants/dns");
  const {
    DNS_TYPE_NUMBERS,
    deduplicateDnsRecords,
    providerOrderForLookup,
    queryDohProvider,
  } = await import("@/lib/dns-utils");
  const { createLogger } = await import("@/lib/logger/server");
  const { ttlForDnsRecord } = await import("@/lib/ttl");

  const logger = createLogger({ source: "dns-fetch" });
  const providers = providerOrderForLookup(domain);
  const types = DNS_RECORD_TYPES;
  const now = new Date();

  for (const provider of providers) {
    try {
      const results = await Promise.all(
        types.map(async (type) => {
          const answers = await queryDohProvider(provider, domain, type, {
            timeoutMs: 2000,
            retries: 1,
            backoffMs: 150,
          });

          const records: DnsRecord[] = [];
          for (const a of answers) {
            // Filter out records that don't match requested type
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

      // Build records with expiry for persistence (use deduplicated to avoid storing duplicates)
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
        success: true,
        data: {
          records: sorted,
          resolver: provider.key,
          recordsWithExpiry,
        },
      };
    } catch (err) {
      logger.info({ err, domain, provider: provider.key }, "provider failed");
      // Try next provider
    }
  }

  // All providers failed - throw retryable error
  throw new RetryableError("All DoH providers failed", { retryAfter: "5s" });
}

// Allow more retries for DNS since DoH providers can be flaky
fetchDnsRecordsStep.maxRetries = 5;

// ============================================================================
// Helper functions (pure, no Node.js dependencies)
// ============================================================================

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
