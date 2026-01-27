/**
 * Hosting persist step.
 *
 * Persists hosting data to the database.
 * This step is shared between the dedicated hostingWorkflow and internal workflows.
 *
 * Note: This step only handles database persistence. Revalidation scheduling
 * should be done at the workflow level using scheduleRevalidationBatchStep.
 */

import type { GeoIpData } from "@domainstack/types";
import type { PersistResult } from "@/lib/workflow/types";
import type { ProviderDetectionData } from "./types";

/**
 * Step: Persist hosting data to database.
 *
 * Creates domain record if needed. Returns lastAccessedAt for use in
 * scheduling revalidation at the workflow level.
 *
 * @param domain - The domain name
 * @param providers - The detected provider data
 * @param geo - Optional GeoIP data
 * @returns Object with lastAccessedAt for scheduling
 */
export async function persistHostingStep(
  domain: string,
  providers: ProviderDetectionData,
  geo: GeoIpData["geo"],
): Promise<PersistResult> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { ttlForHosting } = await import("@/lib/ttl");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertHosting } = await import("@/lib/db/repos/hosting");

  const now = new Date();
  const expiresAt = ttlForHosting(now);

  try {
    const domainRecord = await ensureDomainRecord(domain);

    await upsertHosting({
      domainId: domainRecord.id,
      hostingProviderId: providers.hostingProvider.id,
      emailProviderId: providers.emailProvider.id,
      dnsProviderId: providers.dnsProvider.id,
      geoCity: geo?.city ?? null,
      geoRegion: geo?.region ?? null,
      geoCountry: geo?.country ?? null,
      geoCountryCode: geo?.country_code ?? null,
      geoLat: geo?.lat ?? null,
      geoLon: geo?.lon ?? null,
      fetchedAt: now,
      expiresAt,
    });

    return { lastAccessedAt: domainRecord.lastAccessedAt ?? null };
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting hosting data for ${domain}`,
    });
  }
}
