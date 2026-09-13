import { RetryableError } from "workflow";

import type { DnsFetchData } from "@domainstack/server/dns";

/**
 * Step: Fetch DNS records from DoH providers with fallback.
 *
 * @param domain - The domain to resolve
 * @returns Resolved DNS data; provider failures are retried
 */
export async function fetchDnsRecordsStep(domain: string): Promise<DnsFetchData> {
  "use step";

  const { DnsProviderError, fetchDnsRecords } = await import("@domainstack/server/dns");

  try {
    return await fetchDnsRecords(domain);
  } catch (err) {
    if (err instanceof DnsProviderError) {
      throw new RetryableError("All DoH providers failed", {
        retryAfter: "5s",
      });
    }
    throw err;
  }
}
