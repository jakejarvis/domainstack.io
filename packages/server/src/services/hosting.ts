/**
 * Hosting service - orchestrates DNS + headers fetching, GeoIP lookup, and provider detection.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * Transient errors throw (for TanStack Query to retry).
 * This service always succeeds (no typed errors) - DNS failures would throw,
 * headers failures are handled gracefully.
 */

import {
  ensureDomainRecord,
  resolveOrCreateProviderId,
  upsertCatalogProvider,
  upsertHosting,
} from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";
import { getRedis } from "@domainstack/redis";
import type {
  DnsRecord,
  GeoIpData,
  Header,
  HostingResponse,
  ProviderRef,
} from "@domainstack/types";
import { toRegistrableDomain } from "@domainstack/utils/domain";
import {
  detectDnsProvider,
  detectEmailProvider,
  detectHostingProvider,
  getProvidersFromCatalog,
} from "@domainstack/utils/providers";
import { getProviderCatalog } from "../edge-config";
import { ttlForHosting } from "../ttl";
import { fetchDns } from "./dns";
import { fetchHeaders } from "./headers";

// ============================================================================
// Types
// ============================================================================

export type HostingResult = { success: true; data: HostingResponse };

interface ProviderDetectionData {
  hostingProvider: ProviderRef;
  emailProvider: ProviderRef;
  dnsProvider: ProviderRef;
}

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch and persist hosting data for a domain.
 *
 * Orchestrates the full dependency chain:
 * 1. Fetch DNS records (parallel with headers)
 * 2. Fetch HTTP headers (parallel with DNS) - handles failures gracefully
 * 3. GeoIP lookup (if IP available)
 * 4. Detect providers from headers and DNS records
 * 5. Persist hosting data
 *
 * @param domain - The domain to analyze
 * @returns Hosting result with provider data
 *
 * @throws Error on transient failures (network issues) - TanStack Query retries these
 */
export async function fetchHosting(domain: string): Promise<HostingResult> {
  // Step 1 & 2: Fetch DNS and headers in parallel
  // DNS always succeeds or throws; headers may fail with typed error
  const [dnsResult, headersResult] = await Promise.all([
    fetchDns(domain),
    fetchHeaders(domain).catch(() => ({
      success: false as const,
      error: "fetch_failed" as const,
    })),
  ]);

  // Use available data for provider detection
  const dnsRecords = dnsResult.data.records;
  const headers = headersResult.success ? headersResult.data.headers : [];

  // Step 3: Extract IP from DNS records for GeoIP lookup
  const a = dnsRecords.find((d) => d.type === "A");
  const aaaa = dnsRecords.find((d) => d.type === "AAAA");
  const ip = (a?.value || aaaa?.value) ?? null;

  // Step 4: GeoIP lookup (if we have an IP)
  const geoResult = ip ? await lookupGeoIp(ip) : null;

  // Step 5: Detect providers and resolve IDs
  const providers = await detectAndResolveProviders(
    dnsRecords,
    headers,
    geoResult,
  );

  // Step 6: Persist hosting data to database
  await persistHosting(domain, providers, geoResult?.geo ?? null);

  return {
    success: true,
    data: {
      hostingProvider: providers.hostingProvider,
      emailProvider: providers.emailProvider,
      dnsProvider: providers.dnsProvider,
      geo: geoResult?.geo ?? null,
    },
  };
}

// ============================================================================
// Internal: GeoIP Lookup
// ============================================================================

const geoIpLogger = createLogger({ source: "hosting-geoip" });

async function lookupGeoIp(ip: string): Promise<GeoIpData | null> {
  const logger = geoIpLogger;
  const redis = getRedis();
  const cacheKey = `geoip:${ip}`;

  // Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get<GeoIpData>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (err) {
      logger.warn({ err }, "redis cache read failed, falling back to API");
    }
  }

  // Fetch from iplocate.io API
  const apiKey = process.env.IPLOCATE_API_KEY;

  if (!apiKey) {
    logger.warn("IPLOCATE_API_KEY not configured, skipping IP lookup");
    return null;
  }

  try {
    const url = new URL(
      `https://www.iplocate.io/api/lookup/${encodeURIComponent(ip)}`,
    );
    url.searchParams.set("apikey", apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error(
        { status: res.status, body: body.slice(0, 500) },
        "iplocate.io lookup failed with non-OK status",
      );
      return null;
    }

    const data = (await res.json()) as {
      city?: string;
      subdivision?: string;
      country?: string;
      country_code?: string;
      latitude?: number;
      longitude?: number;
      company?: { name?: string; domain?: string };
      asn?: { name?: string; domain?: string };
      error?: string;
    };

    if (data.error) {
      logger.error({ error: data.error }, "iplocate.io returned error message");
      return null;
    }

    const result: GeoIpData = {
      geo: {
        city: data.city || "",
        region: data.subdivision || "",
        country: data.country || "",
        country_code: data.country_code || "",
        lat: typeof data.latitude === "number" ? data.latitude : null,
        lon: typeof data.longitude === "number" ? data.longitude : null,
      },
      owner: data.company?.name || data.asn?.name || null,
      domain: data.company?.domain || data.asn?.domain || null,
    };

    // Cache in Redis (fire-and-forget)
    if (redis) {
      redis.set(cacheKey, result, { ex: 43200 }).catch((err) => {
        logger.warn({ err }, "redis cache write failed");
      });
    }

    return result;
  } catch (err) {
    logger.error({ err }, "iplocate.io lookup failed");
    return null;
  }
}

// ============================================================================
// Internal: Provider Detection
// ============================================================================

async function detectAndResolveProviders(
  dnsRecords: DnsRecord[],
  headers: Header[],
  geoData: GeoIpData | null,
): Promise<ProviderDetectionData> {
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

  // Hosting provider detection with fallback
  const hostingCatalogProvider = detectHostingProvider(
    headers,
    hostingProviders,
  );

  let hostingName = hostingCatalogProvider?.name ?? null;
  let hostingIconDomain = hostingCatalogProvider?.domain ?? null;
  if (!hostingCatalogProvider) {
    if (geoData?.owner) hostingName = geoData.owner;
    if (geoData?.domain) hostingIconDomain = geoData.domain;
  }

  // Email provider detection
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

  // Fallback to root domain of first MX host
  if (!emailCatalogProvider && mx[0]?.value) {
    const root = toRegistrableDomain(mx[0].value);
    if (root) {
      emailName = root;
      emailIconDomain = root;
    }
  }

  // Fallback to root domain of first NS host
  if (!dnsCatalogProvider && nsRecords[0]?.value) {
    const root = toRegistrableDomain(nsRecords[0].value);
    if (root) {
      dnsName = root;
      dnsIconDomain = root;
    }
  }

  // Resolve provider IDs
  const [hostingProviderId, emailProviderId, dnsProviderId] = await Promise.all(
    [
      hostingCatalogProvider
        ? upsertCatalogProvider(hostingCatalogProvider).then((r) => r.id)
        : hostingName
          ? resolveOrCreateProviderId({
              category: "hosting",
              domain: hostingIconDomain,
              name: hostingName,
            })
          : Promise.resolve(null),
      emailCatalogProvider
        ? upsertCatalogProvider(emailCatalogProvider).then((r) => r.id)
        : emailName
          ? resolveOrCreateProviderId({
              category: "email",
              domain: emailIconDomain,
              name: emailName,
            })
          : Promise.resolve(null),
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

// ============================================================================
// Internal: Persist Hosting
// ============================================================================

async function persistHosting(
  domain: string,
  providers: ProviderDetectionData,
  geo: GeoIpData["geo"],
): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForHosting(now);

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
}
