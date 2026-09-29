import { RetryableError } from "workflow";

import type { DnsFetchData } from "@domainstack/core/dns/types";

/**
 * Step: Fetch DNS records from DoH providers with fallback.
 *
 * @param domain - The domain to resolve
 * @returns Resolved DNS data; provider failures are retried
 */
export async function fetchDnsRecordsStep(domain: string): Promise<DnsFetchData> {
  "use step";

  const { fetchDnsRecords } = await import("@domainstack/core/dns/fetch");
  const { RemoteDataUnavailableError } = await import("@domainstack/core/lib/fetch-errors");

  try {
    return await fetchDnsRecords(domain);
  } catch (err) {
    if (err instanceof RemoteDataUnavailableError) {
      throw new RetryableError("All DoH providers failed", {
        retryAfter: "5s",
      });
    }
    throw err;
  }
}

/**
 * Step: Persist DNS records to database.
 *
 * @param domain - The domain name
 * @param fetchData - The DNS fetch result containing records and expiry metadata
 */
export async function persistDnsRecordsStep(
  domain: string,
  fetchData: DnsFetchData,
): Promise<void> {
  "use step";

  const { persistDnsRecords } = await import("@domainstack/core/dns");
  try {
    await persistDnsRecords(domain, fetchData);
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `persisting DNS records for ${domain}` });
  }
}
