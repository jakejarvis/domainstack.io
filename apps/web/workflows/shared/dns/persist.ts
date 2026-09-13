import type { DnsFetchData } from "@domainstack/server/dns";

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

  const { persistDnsRecords } = await import("@domainstack/server/services/dns");
  try {
    await persistDnsRecords(domain, fetchData);
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, { context: `persisting DNS records for ${domain}` });
  }
}
