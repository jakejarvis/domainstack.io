/**
 * Hosting persist step.
 *
 * Persists hosting data to the database.
 * This step is shared between the dedicated hostingWorkflow and internal workflows.
 */

import { FatalError } from "workflow";
import type { GeoIpData, ProviderDetectionData } from "./types";

/**
 * Step: Persist hosting data to database.
 *
 * Creates domain record if needed and schedules revalidation.
 *
 * @param domain - The domain name
 * @param providers - The detected provider data
 * @param geo - Optional GeoIP data
 */
export async function persistHostingStep(
  domain: string,
  providers: ProviderDetectionData,
  geo: GeoIpData["geo"] | null,
): Promise<void> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { createLogger } = await import("@/lib/logger/server");
  const { ttlForHosting } = await import("@/lib/ttl");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertHosting } = await import("@/lib/db/repos/hosting");
  const { scheduleRevalidation } = await import("@/lib/revalidation");

  const logger = createLogger({ source: "hosting-persist" });
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

    await scheduleRevalidation(
      domain,
      "hosting",
      expiresAt.getTime(),
      domainRecord.lastAccessedAt ?? null,
    );

    logger.debug({ domain }, "persisted hosting data");
  } catch (err) {
    throw new FatalError(
      `Failed to persist hosting data for domain ${domain}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
