import type { GeoIpData, ProviderDetectionData } from "@domainstack/types";

/**
 * Step: Persist hosting data to database.
 *
 * @param domain - The domain name
 * @param providers - The detected provider data
 * @param geo - Optional GeoIP data
 */
export async function persistHostingStep(
  domain: string,
  providers: ProviderDetectionData,
  geo: GeoIpData["geo"],
): Promise<void> {
  "use step";

  const { persistHosting } = await import("@domainstack/server/services/hosting");
  try {
    await persistHosting(domain, providers, geo);
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, { context: `persisting hosting data for ${domain}` });
  }
}
