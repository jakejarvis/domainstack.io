/**
 * Certificates persist step.
 *
 * Persists certificates to the database.
 * This step is shared between the dedicated certificatesWorkflow and internal workflows.
 *
 * Note: This step only handles database persistence. Revalidation scheduling
 * should be done at the workflow level using scheduleRevalidationBatchStep.
 */

import type { CertificatesProcessedData } from "./types";

/** Result from persist step, includes lastAccessedAt for scheduling */
export interface PersistResult {
  lastAccessedAt: Date | null;
}

/**
 * Step: Persist certificates to database.
 *
 * Creates domain record if needed. Returns lastAccessedAt for use in
 * scheduling revalidation at the workflow level.
 *
 * @param domain - The domain name
 * @param processedData - The processed certificates with provider IDs and expiry metadata
 * @returns Object with lastAccessedAt for scheduling
 */
export async function persistCertificatesStep(
  domain: string,
  processedData: CertificatesProcessedData,
): Promise<PersistResult> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { getStepMetadata } = await import("workflow");
  const { createLogger } = await import("@/lib/logger/server");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { replaceCertificates } = await import("@/lib/db/repos/certificates");
  const { ttlForCertificates } = await import("@/lib/ttl");

  const { stepId } = getStepMetadata();
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

    logger.debug({ domain, stepId }, "certificates persisted");

    return { lastAccessedAt: domainRecord.lastAccessedAt ?? null };
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting certificates for ${domain}`,
    });
  }
}
