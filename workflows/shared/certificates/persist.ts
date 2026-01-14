/**
 * Certificates persist step.
 *
 * Persists certificates to the database.
 * This step is shared between the dedicated certificatesWorkflow and internal workflows.
 */

import { FatalError } from "workflow";
import type { CertificatesProcessedData } from "./types";

/**
 * Step: Persist certificates to database.
 *
 * Creates domain record if needed and schedules revalidation.
 *
 * @param domain - The domain name
 * @param processedData - The processed certificates with provider IDs and expiry metadata
 */
export async function persistCertificatesStep(
  domain: string,
  processedData: CertificatesProcessedData,
): Promise<void> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { createLogger } = await import("@/lib/logger/server");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceCertificates } = await import("@/lib/db/repos/certificates");
  const { scheduleRevalidation } = await import("@/lib/revalidation");
  const { ttlForCertificates } = await import("@/lib/ttl");

  const logger = createLogger({ source: "certificates-persist" });
  const now = new Date();

  try {
    // Ensure domain record exists (creates if needed)
    const domainRecord = await ensureDomainRecord(domain);

    const chainWithIds = processedData.certificates.map((c, i) => ({
      issuer: c.issuer,
      subject: c.subject,
      altNames: c.altNames,
      validFrom: new Date(c.validFrom),
      validTo: new Date(c.validTo),
      caProviderId: processedData.providerIds[i],
    }));

    const expiresAt = ttlForCertificates(now, processedData.earliestValidTo);

    await replaceCertificates({
      domainId: domainRecord.id,
      chain: chainWithIds,
      fetchedAt: now,
      expiresAt,
    });

    // Schedule background revalidation
    await scheduleRevalidation(
      domain,
      "certificates",
      expiresAt.getTime(),
      domainRecord.lastAccessedAt ?? null,
    );

    logger.debug({ domain }, "certificates persisted");
  } catch (err) {
    throw new FatalError(
      `Failed to persist certificates for ${domain}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
