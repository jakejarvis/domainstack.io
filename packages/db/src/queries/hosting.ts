import type { HostingResponse } from "@domainstack/types";
import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import {
  domains,
  hosting as hostingTable,
  providers as providersTable,
} from "../schema";
import type { CacheResult } from "../types";

type HostingInsert = InferInsertModel<typeof hostingTable>;

/**
 * Get cached hosting data for a domain with staleness metadata.
 * Returns data even if expired, with `stale: true` flag.
 *
 * Note: This queries the database cache. For fetching fresh data,
 * use `hostingWorkflow` from workflows/hosting-orchestration.
 *
 * Optimized: Uses a single query with JOINs to fetch domain and hosting data,
 * reducing from 2 round trips to 1.
 */
export async function getCachedHosting(
  domain: string,
): Promise<CacheResult<HostingResponse>> {
  const now = Date.now();

  const hp = alias(providersTable, "hp");
  const ep = alias(providersTable, "ep");
  const dp = alias(providersTable, "dp");

  // Single query: JOIN domains -> hosting with provider lookups
  const [row] = await db
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
      fetchedAt: hostingTable.fetchedAt,
      expiresAt: hostingTable.expiresAt,
    })
    .from(domains)
    .innerJoin(hostingTable, eq(hostingTable.domainId, domains.id))
    .leftJoin(hp, eq(hp.id, hostingTable.hostingProviderId))
    .leftJoin(ep, eq(ep.id, hostingTable.emailProviderId))
    .leftJoin(dp, eq(dp.id, hostingTable.dnsProviderId))
    .where(eq(domains.name, domain))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  const { fetchedAt, expiresAt } = row;
  const stale = (expiresAt?.getTime?.() ?? 0) <= now;

  // Only construct geo object if there's meaningful data
  // (at minimum, country_code is required for display)
  const hasGeoData = row.geoCountryCode || row.geoCountry || row.geoCity;

  const result: HostingResponse = {
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
    geo: hasGeoData
      ? {
          city: row.geoCity ?? "",
          region: row.geoRegion ?? "",
          country: row.geoCountry ?? "",
          country_code: row.geoCountryCode ?? "",
          lat: row.geoLat ?? null,
          lon: row.geoLon ?? null,
        }
      : null,
  };

  return { data: result, stale, fetchedAt, expiresAt };
}

export async function upsertHosting(params: HostingInsert) {
  await db.insert(hostingTable).values(params).onConflictDoUpdate({
    target: hostingTable.domainId,
    set: params,
  });
}
