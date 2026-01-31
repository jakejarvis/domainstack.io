/**
 * DNS fetching logic.
 *
 * Pure functions for fetching DNS records from DoH providers.
 * Does not handle persistence - that's done by callers (workflows, services).
 */

import { DNS_RECORD_TYPES, DNS_TYPE_NUMBERS } from "@domainstack/constants";
import type { DnsRecord } from "@domainstack/types";
import {
  deduplicateDnsRecords,
  providerOrderForLookup,
  queryDohProvider,
  sortDnsRecordsByType,
} from "@domainstack/utils/dns";
import { isCloudflareIp } from "../cloudflare";
import { ttlForDnsRecord } from "../ttl";
import type { DnsFetchData } from "./types";

/**
 * Error thrown when all DoH providers fail.
 */
export class DnsProviderError extends Error {
  constructor(message = "All DoH providers failed") {
    super(message);
    this.name = "DnsProviderError";
  }
}

/**
 * Fetch DNS records from DoH providers with fallback.
 *
 * Tries each provider in order until one succeeds.
 * Throws DnsProviderError if all providers fail.
 *
 * @param domain - The domain to resolve
 * @param now - Current timestamp for TTL calculation (defaults to new Date())
 * @returns DNS fetch data with records, resolver, and expiry metadata
 */
export async function fetchDnsRecords(
  domain: string,
  now: Date = new Date(),
): Promise<DnsFetchData> {
  const providers = providerOrderForLookup(domain);
  const types = DNS_RECORD_TYPES;

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

      // Build records with expiry for persistence
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
  throw new DnsProviderError();
}
