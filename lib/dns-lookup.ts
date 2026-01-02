import {
  DNS_TYPE_NUMBERS,
  filterAnswersByType,
  providerOrderForLookup,
  queryDohProvider,
} from "@/lib/dns-utils";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "dns-lookup" });

export type DnsLookupResult = {
  address: string;
  family: 4 | 6;
};

/**
 * Resolve a hostname to IP addresses using DNS-over-HTTPS.
 * This avoids blocking Node.js's limited threadpool (UV_THREADPOOL_SIZE)
 * that is used by the native getaddrinfo() function.
 *
 * Falls back to native dns.lookup() only if all DoH providers fail.
 */
export async function dnsLookupViaHttps(
  hostname: string,
  options?: { all?: boolean },
): Promise<DnsLookupResult | DnsLookupResult[]> {
  const all = options?.all ?? false;

  // Try DoH providers in order
  const providers = providerOrderForLookup(hostname);
  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      const records = await resolveWithProvider(hostname, provider.key);
      if (records.length > 0) {
        return all ? records : records[0];
      }
    } catch (err) {
      logger.debug(
        { err, hostname, provider: provider.key },
        "dns lookup failed for provider",
      );
      lastError = err;
    }
  }

  // All providers failed
  logger.debug(
    { err: lastError, hostname },
    "all DoH providers failed for hostname",
  );

  // Throw the last error to maintain compatibility with native dns.lookup()
  throw lastError instanceof Error ? lastError : new Error("DNS lookup failed");
}

/**
 * Resolve hostname to A and AAAA records using a single DoH provider.
 */
async function resolveWithProvider(
  hostname: string,
  providerKey: string,
): Promise<DnsLookupResult[]> {
  const providers = providerOrderForLookup(hostname);
  const provider = providers.find((p) => p.key === providerKey);
  if (!provider) {
    throw new Error(`Unknown DoH provider: ${providerKey}`);
  }

  // Query both A (IPv4) and AAAA (IPv6) records in parallel
  const [aResults, aaaaResults] = await Promise.allSettled([
    queryDohProvider(provider, hostname, "A"),
    queryDohProvider(provider, hostname, "AAAA"),
  ]);

  const records: DnsLookupResult[] = [];

  // Collect A records (IPv4)
  if (aResults.status === "fulfilled") {
    const filtered = filterAnswersByType(aResults.value, DNS_TYPE_NUMBERS.A);
    for (const answer of filtered) {
      if (answer.data) {
        records.push({ address: answer.data.trim(), family: 4 });
      }
    }
  }

  // Collect AAAA records (IPv6)
  if (aaaaResults.status === "fulfilled") {
    const filtered = filterAnswersByType(
      aaaaResults.value,
      DNS_TYPE_NUMBERS.AAAA,
    );
    for (const answer of filtered) {
      if (answer.data) {
        records.push({ address: answer.data.trim(), family: 6 });
      }
    }
  }

  return records;
}
