import { FatalError } from "workflow";
import type { Provider } from "@/lib/providers/parser";
import type { DnsRecord, Header, HostingResponse } from "@/lib/types";

export interface HostingWorkflowInput {
  domain: string;
  /**
   * DNS records from the dnsWorkflow result.
   * Pass `dnsResult.data.records`.
   */
  dnsRecords: DnsRecord[];
  /**
   * Headers from the headersWorkflow result.
   * Pass `headersResult.data.headers`.
   */
  headers: Header[];
}

export interface HostingWorkflowResult {
  success: boolean;
  data: HostingResponse;
}

// Internal types for step-to-step transfer
interface GeoIpResult {
  geo: {
    city: string;
    region: string;
    country: string;
    country_code: string;
    lat: number | null;
    lon: number | null;
  };
  owner: string | null;
  domain: string | null;
}

interface ProviderDetectionResult {
  hostingProvider: {
    id: string | null;
    name: string | null;
    domain: string | null;
  };
  emailProvider: {
    id: string | null;
    name: string | null;
    domain: string | null;
  };
  dnsProvider: {
    id: string | null;
    name: string | null;
    domain: string | null;
  };
}

/**
 * Durable hosting workflow that computes hosting/email/DNS providers
 * from already-fetched DNS records and headers.
 *
 * Unlike other workflows, this one receives its input data rather than
 * fetching it, since DNS and headers are typically already being fetched
 * by their respective workflows.
 *
 * Steps:
 * 1. GeoIP lookup (if IP available)
 * 2. Detect providers from headers and DNS records
 * 3. Persist to database
 */
export async function hostingWorkflow(
  input: HostingWorkflowInput,
): Promise<HostingWorkflowResult> {
  "use workflow";

  const { domain, dnsRecords, headers } = input;

  // Extract IP from A/AAAA records
  const a = dnsRecords.find((d) => d.type === "A");
  const aaaa = dnsRecords.find((d) => d.type === "AAAA");
  const ip = (a?.value || aaaa?.value) ?? null;

  // Step 1: GeoIP lookup (if we have an IP)
  const geoResult = await lookupGeoIp(ip);

  // Step 2: Detect providers and resolve IDs
  const providers = await detectAndResolveProviders(
    dnsRecords,
    headers,
    geoResult,
    ip,
  );

  // Step 3: Persist to database
  await persistHosting(domain, providers, geoResult.geo);

  return {
    success: true,
    data: {
      hostingProvider: providers.hostingProvider,
      emailProvider: providers.emailProvider,
      dnsProvider: providers.dnsProvider,
      geo: geoResult.geo,
    },
  };
}

/**
 * Step: Lookup GeoIP data for an IP address.
 */
async function lookupGeoIp(ip: string | null): Promise<GeoIpResult> {
  "use step";

  if (!ip) {
    return {
      geo: {
        city: "",
        region: "",
        country: "",
        country_code: "",
        lat: null,
        lon: null,
      },
      owner: null,
      domain: null,
    };
  }

  const { lookupGeoIp: doLookup } = await import("@/lib/geoip");
  return doLookup(ip);
}

/**
 * Step: Detect providers from DNS records and headers, then resolve provider IDs.
 */
async function detectAndResolveProviders(
  dnsRecords: DnsRecord[],
  headers: Header[],
  geoResult: GeoIpResult,
  ip: string | null,
): Promise<ProviderDetectionResult> {
  "use step";

  const { getProviders } = await import("@/lib/providers/catalog");
  const { detectDnsProvider, detectEmailProvider, detectHostingProvider } =
    await import("@/lib/providers/detection");
  const { resolveOrCreateProviderId, upsertCatalogProviderRef } = await import(
    "@/lib/db/repos/providers"
  );
  const { toRegistrableDomain } = await import("@/lib/domain-server");

  // Extract MX and NS records
  const mx = dnsRecords.filter((d) => d.type === "MX");
  const nsRecords = dnsRecords.filter((d) => d.type === "NS");

  // Fetch provider catalogs from Edge Config
  const [hostingProviders, emailProviders, dnsProviders] = await Promise.all([
    getProviders("hosting"),
    getProviders("email"),
    getProviders("dns"),
  ]);

  // Hosting provider detection with fallback:
  // - If no A record/IP → null
  // - Else if unknown → try IP ownership org/ISP
  const hostingMatched = detectHostingProvider(headers, hostingProviders);

  let hostingName = hostingMatched?.name ?? null;
  let hostingIconDomain = hostingMatched?.domain ?? null;
  let hostingCatalogProvider: Provider | null = hostingMatched;
  if (!ip) {
    hostingName = null;
    hostingIconDomain = null;
    hostingCatalogProvider = null;
  } else if (!hostingName) {
    // Unknown provider: try IP ownership org/ISP
    if (geoResult.owner) hostingName = geoResult.owner;
    hostingIconDomain = geoResult.domain ?? null;
    hostingCatalogProvider = null;
  }

  // Determine email provider, null when MX is unset
  const emailMatched =
    mx.length === 0
      ? null
      : detectEmailProvider(
          mx.map((m) => m.value),
          emailProviders,
        );
  let emailName = emailMatched?.name ?? null;
  let emailIconDomain = emailMatched?.domain ?? null;
  const emailCatalogProvider: Provider | null = emailMatched;

  // DNS provider from nameservers
  const dnsMatched = detectDnsProvider(
    nsRecords.map((n) => n.value),
    dnsProviders,
  );
  let dnsName = dnsMatched?.name ?? null;
  let dnsIconDomain = dnsMatched?.domain ?? null;
  const dnsCatalogProvider: Provider | null = dnsMatched;

  // If no known match for email provider, fall back to the root domain of the first MX host
  if (!emailMatched && mx[0]?.value) {
    const root = toRegistrableDomain(mx[0].value);
    if (root) {
      emailName = root;
      emailIconDomain = root;
    }
  }

  // If no known match for DNS provider, fall back to the root domain of the first NS host
  if (!dnsMatched && nsRecords[0]?.value) {
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
        ? upsertCatalogProviderRef(hostingCatalogProvider).then((r) => r.id)
        : hostingName
          ? resolveOrCreateProviderId({
              category: "hosting",
              domain: hostingIconDomain,
              name: hostingName,
            })
          : Promise.resolve(null),
      // Email provider
      emailCatalogProvider
        ? upsertCatalogProviderRef(emailCatalogProvider).then((r) => r.id)
        : emailName
          ? resolveOrCreateProviderId({
              category: "email",
              domain: emailIconDomain,
              name: emailName,
            })
          : Promise.resolve(null),
      // DNS provider
      dnsCatalogProvider
        ? upsertCatalogProviderRef(dnsCatalogProvider).then((r) => r.id)
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

/**
 * Step: Persist hosting data to database.
 */
async function persistHosting(
  domain: string,
  providers: ProviderDetectionResult,
  geo: GeoIpResult["geo"],
): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertHosting } = await import("@/lib/db/repos/hosting");
  const { scheduleRevalidation } = await import("@/lib/schedule");
  const { ttlForHosting } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "hosting-workflow" });
  const now = new Date();
  const expiresAt = ttlForHosting(now);

  try {
    const domainRecord = await ensureDomainRecord(domain);

    await upsertHosting({
      domainId: domainRecord.id,
      hostingProviderId: providers.hostingProvider.id,
      emailProviderId: providers.emailProvider.id,
      dnsProviderId: providers.dnsProvider.id,
      geoCity: geo.city,
      geoRegion: geo.region,
      geoCountry: geo.country,
      geoCountryCode: geo.country_code,
      geoLat: geo.lat ?? null,
      geoLon: geo.lon ?? null,
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
    logger.error({ err, domain }, "failed to persist hosting data");
    throw new FatalError("Failed to persist hosting data");
  }
}
