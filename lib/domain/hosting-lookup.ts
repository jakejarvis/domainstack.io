/**
 * Hosting lookup implementation - core logic for provider detection.
 *
 * This module contains the business logic extracted from the hosting workflow.
 * It's used by both the standalone hostingWorkflow and shared steps.
 */

import { lookupGeoIp as lookupGeoIpFn } from "@/lib/geoip";
import { createLogger } from "@/lib/logger/server";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import { getProviders } from "@/lib/providers/catalog";
import {
  detectDnsProvider,
  detectEmailProvider,
  detectHostingProvider,
} from "@/lib/providers/detection";
import type { Provider } from "@/lib/providers/parser";
import { ttlForHosting } from "@/lib/ttl";
import type { DnsRecord } from "@/lib/types/domain/dns";
import type { Header } from "@/lib/types/domain/headers";
import type { HostingResponse } from "@/lib/types/domain/hosting";

const logger = createLogger({ source: "hosting-lookup" });

export interface GeoIpResult {
  geo: {
    city: string;
    region: string;
    country: string;
    country_emoji: string;
    country_code: string;
    lat: number | null;
    lon: number | null;
  };
  owner: string | null;
  domain: string | null;
}

export interface ProviderDetectionResult {
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
 * Lookup GeoIP data for an IP address.
 */
export async function lookupGeoIp(ip: string | null): Promise<GeoIpResult> {
  if (!ip) {
    return {
      geo: {
        city: "",
        region: "",
        country: "",
        country_emoji: "",
        country_code: "",
        lat: null,
        lon: null,
      },
      owner: null,
      domain: null,
    };
  }

  return lookupGeoIpFn(ip);
}

/**
 * Detect providers from DNS records and headers, then resolve provider IDs.
 */
export async function detectAndResolveProviders(
  dnsRecords: DnsRecord[],
  headers: Header[],
  geoResult: GeoIpResult,
  ip: string | null,
): Promise<ProviderDetectionResult> {
  // Dynamic imports for database operations
  const { resolveOrCreateProviderId, upsertCatalogProvider } = await import(
    "@/lib/db/repos/providers"
  );

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

/**
 * Persist hosting data to database.
 */
export async function persistHostingData(
  domain: string,
  providers: ProviderDetectionResult,
  geo: GeoIpResult["geo"],
): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForHosting(now);

  // Dynamic imports for database operations
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertHosting } = await import("@/lib/db/repos/hosting");
  const { scheduleRevalidation } = await import("@/lib/revalidation");

  const domainRecord = await ensureDomainRecord(domain);

  await upsertHosting({
    domainId: domainRecord.id,
    hostingProviderId: providers.hostingProvider.id,
    emailProviderId: providers.emailProvider.id,
    dnsProviderId: providers.dnsProvider.id,
    geoCity: geo.city,
    geoRegion: geo.region,
    geoCountry: geo.country,
    geoCountryEmoji: geo.country_emoji,
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
}

/**
 * Full hosting lookup and persist in one operation.
 *
 * This is the main entry point for shared steps.
 */
export async function lookupAndPersistHosting(
  domain: string,
  dnsRecords: DnsRecord[],
  headers: Header[],
): Promise<HostingResponse> {
  // Extract IP from A/AAAA records
  const a = dnsRecords.find((d) => d.type === "A");
  const aaaa = dnsRecords.find((d) => d.type === "AAAA");
  const ip = (a?.value || aaaa?.value) ?? null;

  // GeoIP lookup
  const geoResult = await lookupGeoIp(ip);

  // Detect providers
  const providers = await detectAndResolveProviders(
    dnsRecords,
    headers,
    geoResult,
    ip,
  );

  // Persist
  try {
    await persistHostingData(domain, providers, geoResult.geo);
  } catch (err) {
    logger.error({ err, domain }, "failed to persist hosting data");
    // Still return the data even if persistence failed
  }

  return {
    hostingProvider: providers.hostingProvider,
    emailProvider: providers.emailProvider,
    dnsProvider: providers.dnsProvider,
    geo: geoResult.geo,
  };
}
