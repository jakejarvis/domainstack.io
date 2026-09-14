import type { DnsRecord, GeoIpData, Header, ProviderDetectionData } from "@domainstack/types";

/**
 * Step: Lookup GeoIP data for an IP address.
 *
 * @param ip - The IP address to lookup
 * @returns GeoIpData, or null when the lookup produced no data
 */
export async function lookupGeoIpStep(ip: string): Promise<GeoIpData | null> {
  "use step";

  const { lookupGeoIp } = await import("@domainstack/server/services/hosting");
  return await lookupGeoIp(ip);
}

/**
 * Step: Detect providers from DNS records and headers, then resolve provider IDs.
 *
 * @param dnsRecords - DNS records for the domain
 * @param headers - HTTP headers from the domain
 * @param geoData - Optional GeoIP data for hosting provider fallback
 * @returns ProviderDetectionData with resolved provider IDs
 */
export async function detectAndResolveProvidersStep(
  dnsRecords: DnsRecord[],
  headers: Header[],
  geoData: GeoIpData | null,
): Promise<ProviderDetectionData> {
  "use step";

  const { detectAndResolveProviders } = await import("@domainstack/server/services/hosting");
  return await detectAndResolveProviders(dnsRecords, headers, geoData);
}

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
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `persisting hosting data for ${domain}` });
  }
}
