import type { CertificatesProcessedData } from "@domainstack/server/services/certificates";

/**
 * Step: Persist certificates to database.
 *
 * @param domain - The domain name
 * @param processedData - The processed certificates with provider IDs and expiry metadata
 */
export async function persistCertificatesStep(
  domain: string,
  processedData: CertificatesProcessedData,
): Promise<void> {
  "use step";

  const { persistCertificates } = await import("@domainstack/server/services/certificates");
  try {
    await persistCertificates(domain, processedData);
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, { context: `persisting certificates for ${domain}` });
  }
}
