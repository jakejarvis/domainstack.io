/**
 * DNS persist step.
 *
 * Persists DNS records to the database.
 * This step is shared between the dedicated dnsWorkflow and internal workflows.
 */

import type { DnsRecordType } from "@/lib/constants/dns";
import type { DnsFetchData } from "./types";

/**
 * Step: Persist DNS records to database.
 *
 * Creates domain record if needed and schedules revalidation.
 *
 * @param domain - The domain name
 * @param fetchData - The DNS fetch result containing records and expiry metadata
 */
export async function persistDnsRecordsStep(
  domain: string,
  fetchData: DnsFetchData,
): Promise<void> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { DNS_RECORD_TYPES } = await import("@/lib/constants/dns");
  const { createLogger } = await import("@/lib/logger/server");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceDns } = await import("@/lib/db/repos/dns");
  const { scheduleRevalidation } = await import("@/lib/revalidation");

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

    // Schedule revalidation
    const times = fetchData.recordsWithExpiry
      .map((r) => new Date(r.expiresAt).getTime())
      .filter((t) => Number.isFinite(t));
    const soonest = times.length > 0 ? Math.min(...times) : now.getTime();

    await scheduleRevalidation(
      domain,
      "dns",
      soonest,
      domainRecord.lastAccessedAt ?? null,
    );

    logger.debug(
      { domain, recordCount: fetchData.recordsWithExpiry.length },
      "dns records persisted",
    );
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting DNS records for ${domain}`,
    });
  }
}
