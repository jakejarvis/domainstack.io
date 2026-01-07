import { after } from "next/server";
import { start } from "workflow/api";
import { upsertHosting } from "@/lib/db/repos/hosting";
import {
  resolveOrCreateProviderId,
  upsertCatalogProviderRef,
} from "@/lib/db/repos/providers";
import { toRegistrableDomain } from "@/lib/domain-server";
import { lookupGeoIp } from "@/lib/geoip";
import { createLogger } from "@/lib/logger/server";
import { getProviders } from "@/lib/providers/catalog";
import {
  detectDnsProvider,
  detectEmailProvider,
  detectHostingProvider,
} from "@/lib/providers/detection";
import type { Provider } from "@/lib/providers/parser";
import { scheduleRevalidation } from "@/lib/schedule";
import { ttlForHosting } from "@/lib/ttl";
import type { HostingResponse } from "@/lib/types";
import { dnsWorkflow } from "@/workflows/dns";
import { headersWorkflow } from "@/workflows/headers";

const logger = createLogger({ source: "hosting" });

export type ServiceOptions = {
  skipScheduling?: boolean;
};

/**
 * Fetch fresh hosting, email, and DNS provider data for a domain.
 *
 * This function always fetches fresh data (no cache checking).
 * Cache checking is done at the tRPC layer before calling this function.
 */
export async function fetchHosting(
  domain: string,
  options: ServiceOptions = {},
): Promise<HostingResponse> {
  // Generate single timestamp for access tracking and scheduling
  const now = new Date();

  // Get DNS records via workflow
  const dnsRun = await start(dnsWorkflow, [{ domain }]);
  const dnsResult = await dnsRun.returnValue;
  const dns = dnsResult.data.records;
  const a = dns.find((d) => d.type === "A");
  const aaaa = dns.find((d) => d.type === "AAAA");
  const mx = dns.filter((d) => d.type === "MX");
  const nsRecords = dns.filter((d) => d.type === "NS");
  const ip = (a?.value || aaaa?.value) ?? null;
  const hasWebHosting = a !== undefined || aaaa !== undefined;

  // Parallelize headers probe and IP lookup when web hosting exists
  const [headersResult, meta] = await Promise.all([
    hasWebHosting
      ? start(headersWorkflow, [{ domain }])
          .then((run) => run.returnValue)
          .then((result) => result.data)
          .catch((err) => {
            logger.error({ err, domain });
            return {
              headers: [] as { name: string; value: string }[],
              status: 0,
              statusMessage: undefined,
            };
          })
      : Promise.resolve({
          headers: [] as { name: string; value: string }[],
          status: 0,
          statusMessage: undefined,
        }),
    ip
      ? lookupGeoIp(ip)
      : Promise.resolve({
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
        }),
  ]);

  const headers = headersResult.headers;
  const geo = meta.geo;

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
    if (meta.owner) hostingName = meta.owner;
    hostingIconDomain = meta.domain ?? null;
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

  const info: HostingResponse = {
    hostingProvider: {
      id: null,
      name: hostingName,
      domain: hostingIconDomain,
    },
    emailProvider: { id: null, name: emailName, domain: emailIconDomain },
    dnsProvider: { id: null, name: dnsName, domain: dnsIconDomain },
    geo,
  };

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

  // Update the info object with resolved IDs
  info.hostingProvider.id = hostingProviderId;
  info.emailProvider.id = emailProviderId;
  info.dnsProvider.id = dnsProviderId;

  // Persist to Postgres - ensure domain record exists (creates if needed)
  const expiresAt = ttlForHosting(now);
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");

  try {
    const domainRecord = await ensureDomainRecord(domain);

    await upsertHosting({
      domainId: domainRecord.id,
      hostingProviderId,
      emailProviderId,
      dnsProviderId,
      geoCity: geo.city,
      geoRegion: geo.region,
      geoCountry: geo.country,
      geoCountryCode: geo.country_code,
      geoLat: geo.lat ?? null,
      geoLon: geo.lon ?? null,
      fetchedAt: now,
      expiresAt,
    });

    if (!options.skipScheduling) {
      after(() =>
        scheduleRevalidation(
          domain,
          "hosting",
          expiresAt.getTime(),
          domainRecord.lastAccessedAt ?? null,
        ),
      );
    }
  } catch (err) {
    logger.error({ err, domain }, "failed to persist hosting data");
    // Don't throw - persistence failure shouldn't fail the response
  }

  return info;
}
