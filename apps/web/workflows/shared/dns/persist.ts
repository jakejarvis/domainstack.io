/**
 * DNS persist step.
 *
 * Persists DNS records to the database.
 * This step is shared between the dedicated dnsWorkflow and internal workflows.
 *
 * Note: This step only handles database persistence. Revalidation scheduling
 * should be done at the workflow level using scheduleRevalidationBatchStep.
 */

import type { DnsRecordType } from "@domainstack/constants";
import type { PersistResult } from "@/lib/workflow/types";
import type { DnsFetchData } from "./types";

/**
 * Step: Persist DNS records to database.
 *
 * Creates domain record if needed. Returns lastAccessedAt for use in
 * scheduling revalidation at the workflow level.
 *
 * @param domain - The domain name
 * @param fetchData - The DNS fetch result containing records and expiry metadata
 * @returns Object with lastAccessedAt for scheduling
 */
export async function persistDnsRecordsStep(
  domain: string,
  fetchData: DnsFetchData,
): Promise<PersistResult> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { DNS_RECORD_TYPES } = await import("@domainstack/constants");
  const { domainsRepo, dnsRepo } = await import("@/lib/db/repos");

  const types = DNS_RECORD_TYPES;
  const now = new Date();

  try {
    // Ensure domain record exists (creates if needed)
    const domainRecord = await domainsRepo.ensureDomainRecord(domain);

    // Group records by type for replaceDns
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

    await dnsRepo.replaceDns({
      domainId: domainRecord.id,
      resolver: fetchData.resolver,
      fetchedAt: now,
      recordsByType,
    });

    return { lastAccessedAt: domainRecord.lastAccessedAt ?? null };
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting DNS records for ${domain}`,
    });
  }
}
