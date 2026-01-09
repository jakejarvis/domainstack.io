import {
  DNS_TYPE_NUMBERS,
  filterAnswersByType,
  providerOrderForLookup,
  queryDohProvider,
} from "@/lib/dns-utils";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "resolver" });

type DohLookupResult = {
  address: string;
  family: 4 | 6;
};

/**
 * Resolve a hostname to IP addresses using DNS-over-HTTPS.
 * This avoids blocking Node.js's limited threadpool (UV_THREADPOOL_SIZE)
 * that is used by the native getaddrinfo() function.
 */
export async function dohLookup(
  hostname: string,
  options?: { all?: boolean },
): Promise<DohLookupResult | DohLookupResult[]> {
  const all = options?.all ?? false;

  // Try DoH providers in order
  const providers = providerOrderForLookup(hostname);
  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      // Query both A (IPv4) and AAAA (IPv6) records in parallel
      const [aResults, aaaaResults] = await Promise.allSettled([
        queryDohProvider(provider, hostname, "A"),
        queryDohProvider(provider, hostname, "AAAA"),
      ]);

      const records: DohLookupResult[] = [];

      if (aResults.status === "fulfilled") {
        // Collect A records (IPv4)
        const filtered = filterAnswersByType(
          aResults.value,
          DNS_TYPE_NUMBERS.A,
        );
        for (const answer of filtered) {
          if (answer.data) {
            records.push({ address: answer.data.trim(), family: 4 });
          }
        }
      }

      if (aaaaResults.status === "fulfilled") {
        // Collect AAAA records (IPv6)
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

      if (records.length > 0) {
        return all ? records : records[0];
      }
    } catch (err) {
      logger.debug({ err, hostname, provider: provider.key });
      lastError = err;
    }
  }

  // Throw the last error to maintain compatibility with native dns.lookup()
  throw lastError instanceof Error ? lastError : new Error("DNS lookup failed");
}
