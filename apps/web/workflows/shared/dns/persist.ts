/**
 * DNS persist step.
 *
 * Persists DNS records to the database.
 * This step is shared between the dedicated dnsWorkflow and internal workflows.
 *
 * Note: This step only handles database persistence. Revalidation scheduling
 * should be done at the workflow level using scheduleRevalidationBatchStep.
 */

import type { PersistResult } from "@/lib/workflow/types";
import type { DnsRecordType } from "@domainstack/constants";

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
  const { ensureDomainRecord, replaceDns } = await import("@domainstack/db/queries");

  const types = DNS_RECORD_TYPES;
  const now = new Date();

  try {
    // Ensure domain record exists (creates if needed)
    const domainRecord = await ensureDomainRecord(domain);

    // Group records by type for replaceDns
    type PersistDnsRecord = {
      name: string;
      value: string;
      ttl: number | undefined;
      priority: number | undefined;
      isCloudflare: boolean | undefined;
      expiresAt: Date;
    };

    const recordsByType = Object.fromEntries(
      types.map((t) => [t, [] as PersistDnsRecord[]]),
    ) as Record<DnsRecordType, PersistDnsRecord[]>;

    for (const r of fetchData.recordsWithExpiry) {
      recordsByType[r.type].push({
        name: r.name,
        value: r.value,
        ttl: r.ttl,
        priority: r.priority,
        isCloudflare: r.isCloudflare,
        expiresAt: new Date(r.expiresAt),
      });
    }

    await replaceDns({
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
