/**
 * Hosting detection steps.
 *
 * GeoIP lookup and provider detection from DNS/headers.
 * These steps are shared between the dedicated hostingWorkflow and internal workflows.
 */

import type { DnsRecord, GeoIpData, Header } from "@domainstack/types";
import type { ProviderDetectionData } from "./types";

/**
 * Step: Lookup GeoIP data for an IP address.
 *
 * @param ip - The IP address to lookup
 * @returns GeoIpData with location and ownership info
 */
export async function lookupGeoIpStep(ip: string): Promise<GeoIpData> {
  "use step";

  const { lookupGeoIp } = await import("@/lib/geoip");
  return lookupGeoIp(ip);
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

  // Dynamic imports for Node.js modules and database operations
  const { toRegistrableDomain } = await import("@/lib/normalize-domain");
  const { getProviderCatalog } = await import(
    "@domainstack/server/edge-config"
  );
  const {
    detectDnsProvider,
    detectEmailProvider,
    detectHostingProvider,
    getProvidersFromCatalog,
  } = await import("@domainstack/core/providers");
  const { upsertCatalogProvider, resolveOrCreateProviderId } = await import(
    "@domainstack/db/queries"
  );

  // Extract MX and NS records
  const mx = dnsRecords.filter((d) => d.type === "MX");
  const nsRecords = dnsRecords.filter((d) => d.type === "NS");

  // Fetch provider catalog from Edge Config
  const catalog = await getProviderCatalog();
  const hostingProviders = catalog
    ? getProvidersFromCatalog(catalog, "hosting")
    : [];
  const emailProviders = catalog
    ? getProvidersFromCatalog(catalog, "email")
    : [];
  const dnsProviders = catalog ? getProvidersFromCatalog(catalog, "dns") : [];

  // Hosting provider detection with fallback:
  // - If no A record/IP → null
  // - Else if unknown → try IP ownership org/ISP
  const hostingCatalogProvider = detectHostingProvider(
    headers,
    hostingProviders,
  );

  let hostingName = hostingCatalogProvider?.name ?? null;
  let hostingIconDomain = hostingCatalogProvider?.domain ?? null;
  if (!hostingCatalogProvider) {
    // Unknown hostingCatalogProvider: try IP ownership org/ISP
    if (geoData?.owner) hostingName = geoData.owner;
    if (geoData?.domain) hostingIconDomain = geoData.domain;
  }

  // Determine email provider, null when MX is unset
  const emailCatalogProvider =
    mx.length === 0
      ? null
      : detectEmailProvider(
          mx.map((m) => m.value),
          emailProviders,
        );
  let emailName = emailCatalogProvider?.name ?? null;
  let emailIconDomain = emailCatalogProvider?.domain ?? null;

  // DNS provider from nameservers
  const dnsCatalogProvider = detectDnsProvider(
    nsRecords.map((n) => n.value),
    dnsProviders,
  );
  let dnsName = dnsCatalogProvider?.name ?? null;
  let dnsIconDomain = dnsCatalogProvider?.domain ?? null;

  // If no known match for email provider, fall back to the root domain of the first MX host
  if (!emailCatalogProvider && mx[0]?.value) {
    const root = toRegistrableDomain(mx[0].value);
    if (root) {
      emailName = root;
      emailIconDomain = root;
    }
  }

  // If no known match for DNS provider, fall back to the root domain of the first NS host
  if (!dnsCatalogProvider && nsRecords[0]?.value) {
    const root = toRegistrableDomain(nsRecords[0].value);
    if (root) {
      dnsName = root;
      dnsIconDomain = root;
    }
  }

  // Resolve provider IDs - upsert catalog providers, create discovered for fallbacks
  const [hostingProviderId, emailProviderId, dnsProviderId] = await Promise.all(
    [
      // Hosting provider
      hostingCatalogProvider
        ? upsertCatalogProvider(hostingCatalogProvider).then((r) => r.id)
        : hostingName
          ? resolveOrCreateProviderId({
              category: "hosting",
              domain: hostingIconDomain,
              name: hostingName,
            })
          : Promise.resolve(null),
      // Email provider
      emailCatalogProvider
        ? upsertCatalogProvider(emailCatalogProvider).then((r) => r.id)
        : emailName
          ? resolveOrCreateProviderId({
              category: "email",
              domain: emailIconDomain,
              name: emailName,
            })
          : Promise.resolve(null),
      // DNS provider
      dnsCatalogProvider
        ? upsertCatalogProvider(dnsCatalogProvider).then((r) => r.id)
        : dnsName
          ? resolveOrCreateProviderId({
              category: "dns",
              domain: dnsIconDomain,
              name: dnsName,
            })
          : Promise.resolve(null),
    ],
  );

  return {
    hostingProvider: {
      id: hostingProviderId,
      name: hostingName,
      domain: hostingIconDomain,
    },
    emailProvider: {
      id: emailProviderId,
      name: emailName,
      domain: emailIconDomain,
    },
    dnsProvider: {
      id: dnsProviderId,
      name: dnsName,
      domain: dnsIconDomain,
    },
  };
}
