/**
 * DNS fetch step.
 *
 * Fetches DNS records from DoH providers with fallback.
 * This step is shared between the dedicated dnsWorkflow and internal workflows.
 */

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

  const { DnsProviderError, fetchDnsRecords } = await import(
    "@domainstack/server/dns"
  );

  try {
    const data = await fetchDnsRecords(domain);
    return { success: true, data };
  } catch (err) {
    if (err instanceof DnsProviderError) {
      throw new RetryableError("All DoH providers failed", {
        retryAfter: "5s",
      });
    }
    throw err;
  }
}

// Allow more retries for DNS since DoH providers can be flaky
fetchDnsRecordsStep.maxRetries = 5;
