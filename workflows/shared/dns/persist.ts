/**
 * DNS persist step.
 *
 * Persists DNS records to the database.
 * This step is shared between the dedicated dnsWorkflow and internal workflows.
 *
 * Note: This step only handles database persistence. Revalidation scheduling
 * should be done at the workflow level using scheduleRevalidationBatchStep.
 */

import type { DnsRecordType } from "@/lib/constants/dns";
import type { DnsFetchData } from "./types";

/** Result from persist step, includes lastAccessedAt for scheduling */
export interface PersistResult {
  lastAccessedAt: Date | null;
}

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
  const { getStepMetadata } = await import("workflow");
  const { DNS_RECORD_TYPES } = await import("@/lib/constants/dns");
  const { createLogger } = await import("@/lib/logger/server");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceDns } = await import("@/lib/db/repos/dns");

  const { stepId } = getStepMetadata();
  const logger = createLogger({ source: "dns-persist" });
  const types = DNS_RECORD_TYPES;
  const now = new Date();

  try {
    // Ensure domain record exists (creates if needed)
    const domainRecord = await ensureDomainRecord(domain);

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

    await replaceDns({
      domainId: domainRecord.id,
      resolver: fetchData.resolver,
      fetchedAt: now,
      recordsByType,
    });

    logger.debug(
      {
        domain,
        recordCount: fetchData.recordsWithExpiry.length,
        stepId,
      },
      "dns records persisted",
    );

    return { lastAccessedAt: domainRecord.lastAccessedAt ?? null };
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting DNS records for ${domain}`,
    });
  }
}
