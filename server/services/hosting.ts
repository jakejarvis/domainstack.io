import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { after } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { findDomainByName } from "@/lib/db/repos/domains";
import { upsertHosting } from "@/lib/db/repos/hosting";
import {
  resolveOrCreateProviderId,
  upsertCatalogProviderRef,
} from "@/lib/db/repos/providers";
import {
  hosting as hostingTable,
  providers as providersTable,
} from "@/lib/db/schema";
import { toRegistrableDomain } from "@/lib/domain-server";
import { createLogger } from "@/lib/logger/server";
import { getProviders } from "@/lib/providers/catalog";
import {
  detectDnsProvider,
  detectEmailProvider,
  detectHostingProvider,
} from "@/lib/providers/detection";
import { scheduleRevalidation } from "@/lib/schedule";
import type { HostingResponse, Provider } from "@/lib/schemas";
import { ttlForHosting } from "@/lib/ttl";
import { getDnsRecords } from "@/server/services/dns";
import { getHeaders } from "@/server/services/headers";
import { lookupIpMeta } from "@/server/services/ip";

const logger = createLogger({ source: "hosting" });

export type ServiceOptions = {
  skipScheduling?: boolean;
};

/**
 * Detect hosting, email, and DNS providers for a domain with Postgres caching.
 *
 * Wrapped in React's cache() for per-request deduplication during SSR,
 * ensuring multiple components can query hosting without triggering duplicate
 * fetches of DNS and headers data.
 */
export const getHosting = cache(async function getHosting(
  domain: string,
  options: ServiceOptions = {},
): Promise<HostingResponse> {
  // Generate single timestamp for access tracking and scheduling
  const now = new Date();
  const nowMs = now.getTime();

  // Fast path: Check Postgres for cached hosting data with providers in single query
  const existingDomain = await findDomainByName(domain);
  if (existingDomain) {
    const hp = alias(providersTable, "hp");
    const ep = alias(providersTable, "ep");
    const dp = alias(providersTable, "dp");
    const existing = await db
      .select({
        hostingProviderId: hp.id,
        hostingProviderName: hp.name,
        hostingProviderDomain: hp.domain,
        emailProviderId: ep.id,
        emailProviderName: ep.name,
        emailProviderDomain: ep.domain,
        dnsProviderId: dp.id,
        dnsProviderName: dp.name,
        dnsProviderDomain: dp.domain,
        geoCity: hostingTable.geoCity,
        geoRegion: hostingTable.geoRegion,
        geoCountry: hostingTable.geoCountry,
        geoCountryCode: hostingTable.geoCountryCode,
        geoLat: hostingTable.geoLat,
        geoLon: hostingTable.geoLon,
        expiresAt: hostingTable.expiresAt,
      })
      .from(hostingTable)
      .leftJoin(hp, eq(hp.id, hostingTable.hostingProviderId))
      .leftJoin(ep, eq(ep.id, hostingTable.emailProviderId))
      .leftJoin(dp, eq(dp.id, hostingTable.dnsProviderId))
      .where(eq(hostingTable.domainId, existingDomain.id))
      .limit(1);
    const row = existing[0];
    if (row && (row.expiresAt?.getTime?.() ?? 0) > nowMs) {
      const info: HostingResponse = {
        hostingProvider: {
          id: row.hostingProviderId ?? null,
          name: row.hostingProviderName ?? null,
          domain: row.hostingProviderDomain ?? null,
        },
        emailProvider: {
          id: row.emailProviderId ?? null,
          name: row.emailProviderName ?? null,
          domain: row.emailProviderDomain ?? null,
        },
        dnsProvider: {
          id: row.dnsProviderId ?? null,
          name: row.dnsProviderName ?? null,
          domain: row.dnsProviderDomain ?? null,
        },
        geo: {
          city: row.geoCity ?? "",
          region: row.geoRegion ?? "",
          country: row.geoCountry ?? "",
          country_code: row.geoCountryCode ?? "",
          lat: row.geoLat ?? null,
          lon: row.geoLon ?? null,
        },
      };

      return info;
    }
  }

  const { records: dns } = await getDnsRecords(domain);
  const a = dns.find((d) => d.type === "A");
  const aaaa = dns.find((d) => d.type === "AAAA");
  const mx = dns.filter((d) => d.type === "MX");
  const nsRecords = dns.filter((d) => d.type === "NS");
  const ip = (a?.value || aaaa?.value) ?? null;
  const hasWebHosting = a !== undefined || aaaa !== undefined;

  // Parallelize headers probe and IP lookup when web hosting exists
  const [headersResponse, meta] = await Promise.all([
    hasWebHosting
      ? getHeaders(domain).catch((err) => {
          logger.error("headers probe error", err, { domain });
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
      ? lookupIpMeta(ip)
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

  const headers = headersResponse.headers;
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

  // Persist to Postgres only if domain exists (i.e., is registered)
  const expiresAt = ttlForHosting(now);

  if (existingDomain) {
    await upsertHosting({
      domainId: existingDomain.id,
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
          existingDomain.lastAccessedAt ?? null,
        ),
      );
    }
  }

  return info;
});
