/**
 * DNS fetch step.
 *
 * Fetches DNS records from DoH providers with fallback.
 * This step is shared between the dedicated dnsWorkflow and internal workflows.
 */

import type { DnsRecord } from "@domainstack/types";
import { RetryableError } from "workflow";
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
  const { DNS_TYPE_NUMBERS, DNS_RECORD_TYPES } = await import(
    "@domainstack/constants"
  );
  const {
    deduplicateDnsRecords,
    providerOrderForLookup,
    queryDohProvider,
    sortDnsRecordsByType,
  } = await import("@domainstack/core/dns");
  const { ttlForDnsRecord } = await import("@/lib/ttl");

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
    } catch {
      // Try next provider
    }
  }

  // All providers failed - throw retryable error
  throw new RetryableError("All DoH providers failed", { retryAfter: "5s" });
}

// Allow more retries for DNS since DoH providers can be flaky
fetchDnsRecordsStep.maxRetries = 5;
