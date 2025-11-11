import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import { findDomainByName } from "@/lib/db/repos/domains";
import { upsertHosting } from "@/lib/db/repos/hosting";
import {
  batchResolveOrCreateProviderIds,
  makeProviderKey,
} from "@/lib/db/repos/providers";
import {
  hosting as hostingTable,
  providers as providersTable,
} from "@/lib/db/schema";
import { ttlForHosting } from "@/lib/db/ttl";
import { toRegistrableDomain } from "@/lib/domain-server";
import {
  detectDnsProvider,
  detectEmailProvider,
  detectHostingProvider,
} from "@/lib/providers/detection";
import { scheduleRevalidation } from "@/lib/schedule";
import type { Hosting } from "@/lib/schemas";
import { resolveAll } from "@/server/services/dns";
import { probeHeaders } from "@/server/services/headers";
import { lookupIpMeta } from "@/server/services/ip";

export async function detectHosting(domain: string): Promise<Hosting> {
  console.debug(`[hosting] start ${domain}`);

  // Only support registrable domains (no subdomains, IPs, or invalid TLDs)
  const registrable = toRegistrableDomain(domain);
  if (!registrable) {
    throw new Error(`Cannot extract registrable domain from ${domain}`);
  }

  // Generate single timestamp for access tracking and scheduling
  const now = new Date();
  const nowMs = now.getTime();

  // Fast path: Check Postgres for cached hosting data with providers in single query
  const existingDomain = await findDomainByName(registrable);
  if (existingDomain) {
    const hp = alias(providersTable, "hp");
    const ep = alias(providersTable, "ep");
    const dp = alias(providersTable, "dp");
    const existing = await db
      .select({
        hostingProviderName: hp.name,
        hostingProviderDomain: hp.domain,
        emailProviderName: ep.name,
        emailProviderDomain: ep.domain,
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
      const info: Hosting = {
        hostingProvider: {
          name: row.hostingProviderName ?? null,
          domain: row.hostingProviderDomain ?? null,
        },
        emailProvider: {
          name: row.emailProviderName ?? null,
          domain: row.emailProviderDomain ?? null,
        },
        dnsProvider: {
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
      console.info(
        `[hosting] cache hit ${domain} hosting=${info.hostingProvider.name} email=${info.emailProvider.name} dns=${info.dnsProvider.name}`,
      );
      return info;
    }
  }

  const { records: dns } = await resolveAll(domain);
  const a = dns.find((d) => d.type === "A");
  const aaaa = dns.find((d) => d.type === "AAAA");
  const mx = dns.filter((d) => d.type === "MX");
  const nsRecords = dns.filter((d) => d.type === "NS");
  const ip = (a?.value || aaaa?.value) ?? null;
  const hasWebHosting = a !== undefined || aaaa !== undefined;

  // Parallelize headers probe and IP lookup when web hosting exists
  const [headersResponse, meta] = await Promise.all([
    hasWebHosting
      ? probeHeaders(domain).catch(() => ({
          headers: [] as { name: string; value: string }[],
          status: 0,
          statusMessage: undefined,
        }))
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

  // Hosting provider detection with fallback:
  // - If no A record/IP → null
  // - Else if unknown → try IP ownership org/ISP
  const hostingDetected = detectHostingProvider(headers);

  let hostingName = hostingDetected.name;
  let hostingIconDomain = hostingDetected.domain;
  if (!ip) {
    hostingName = null;
    hostingIconDomain = null;
  } else if (!hostingName) {
    // Unknown provider: try IP ownership org/ISP
    if (meta.owner) hostingName = meta.owner;
    hostingIconDomain = meta.domain ?? null;
  }

  // Determine email provider, null when MX is unset
  const emailDetected =
    mx.length === 0
      ? { name: null, domain: null }
      : detectEmailProvider(mx.map((m) => m.value));
  let emailName = emailDetected.name;
  let emailIconDomain = emailDetected.domain;

  // DNS provider from nameservers
  const dnsDetected = detectDnsProvider(nsRecords.map((n) => n.value));
  let dnsName = dnsDetected.name;
  let dnsIconDomain = dnsDetected.domain;

  // If no known match for email provider, fall back to the root domain of the first MX host
  if (emailName && !emailIconDomain && mx[0]?.value) {
    const root = toRegistrableDomain(mx[0].value);
    if (root) {
      emailName = root;
      emailIconDomain = root;
    }
  }

  // If no known match for DNS provider, fall back to the root domain of the first NS host
  if (!dnsIconDomain && nsRecords[0]?.value) {
    const root = toRegistrableDomain(nsRecords[0].value);
    if (root) {
      dnsName = root;
      dnsIconDomain = root;
    }
  }

  const info: Hosting = {
    hostingProvider: { name: hostingName, domain: hostingIconDomain },
    emailProvider: { name: emailName, domain: emailIconDomain },
    dnsProvider: { name: dnsName, domain: dnsIconDomain },
    geo,
  };

  // Persist to Postgres only if domain exists (i.e., is registered)
  const expiresAt = ttlForHosting(now);
  const dueAtMs = expiresAt.getTime();

  if (existingDomain) {
    // Batch resolve all providers in one query
    const providerInputs = [
      hostingName
        ? {
            category: "hosting" as const,
            domain: hostingIconDomain,
            name: hostingName,
          }
        : null,
      emailName
        ? {
            category: "email" as const,
            domain: emailIconDomain,
            name: emailName,
          }
        : null,
      dnsName
        ? { category: "dns" as const, domain: dnsIconDomain, name: dnsName }
        : null,
    ].filter((p): p is NonNullable<typeof p> => p !== null);

    const providerMap = await batchResolveOrCreateProviderIds(providerInputs);

    const hostingProviderId = hostingName
      ? (providerMap.get(
          makeProviderKey("hosting", hostingIconDomain, hostingName),
        ) ?? null)
      : null;

    const emailProviderId = emailName
      ? (providerMap.get(
          makeProviderKey("email", emailIconDomain, emailName),
        ) ?? null)
      : null;

    const dnsProviderId = dnsName
      ? (providerMap.get(makeProviderKey("dns", dnsIconDomain, dnsName)) ??
        null)
      : null;

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

    try {
      await scheduleRevalidation(
        registrable,
        "hosting",
        dueAtMs,
        existingDomain.lastAccessedAt ?? null,
      );
    } catch (err) {
      console.warn(
        `[hosting] schedule failed for ${registrable}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }
  console.info(
    `[hosting] ok ${registrable} hosting=${hostingName} email=${emailName} dns=${dnsName}`,
  );
  return info;
}
