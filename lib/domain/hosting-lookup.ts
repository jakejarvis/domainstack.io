/**
 * Hosting lookup implementation - core logic for provider detection.
 *
 * This module contains the business logic extracted from the hosting workflow.
 * It's used by both the standalone hostingWorkflow and shared steps.
 */

import { lookupGeoIp } from "@/lib/geoip";
import { createLogger } from "@/lib/logger/server";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import { getProviders } from "@/lib/providers/catalog";
import {
  detectDnsProvider,
  detectEmailProvider,
  detectHostingProvider,
} from "@/lib/providers/detection";
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
 * Detect providers from DNS records and headers, then resolve provider IDs.
 */
export async function detectAndResolveProviders(
  dnsRecords: DnsRecord[],
  headers: Header[],
  geoResult: GeoIpResult | null,
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
  const hostingCatalogProvider = detectHostingProvider(
    headers,
    hostingProviders,
  );

  let hostingName = hostingCatalogProvider?.name ?? null;
  let hostingIconDomain = hostingCatalogProvider?.domain ?? null;
  if (!hostingCatalogProvider) {
    // Unknown hostingCatalogProvider: try IP ownership org/ISP
    if (geoResult?.owner) hostingName = geoResult.owner;
    if (geoResult?.domain) hostingIconDomain = geoResult.domain;
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

/**
 * Persist hosting data to database.
 */
export async function persistHostingData(
  domain: string,
  providers: ProviderDetectionResult,
  geo: GeoIpResult["geo"] | null,
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
  const geoResult = ip ? await lookupGeoIp(ip) : null;

  // Detect providers
  const providers = await detectAndResolveProviders(
    dnsRecords,
    headers,
    geoResult,
  );

  // Persist
  try {
    await persistHostingData(domain, providers, geoResult?.geo ?? null);
  } catch (err) {
    logger.error({ err, domain }, "failed to persist hosting data");
    // Still return the data even if persistence failed
  }

  return {
    hostingProvider: providers.hostingProvider,
    emailProvider: providers.emailProvider,
    dnsProvider: providers.dnsProvider,
    geo: geoResult?.geo ?? null,
  };
}
