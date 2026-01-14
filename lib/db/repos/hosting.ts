import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import {
  hosting as hostingTable,
  providers as providersTable,
} from "@/lib/db/schema";
import type { HostingResponse } from "@/lib/types/domain/hosting";
import { findDomainByName } from "./domains";
import type { CacheResult } from "./types";

type HostingInsert = InferInsertModel<typeof hostingTable>;

/**
 * Get cached hosting data for a domain with staleness metadata.
 * Returns data even if expired, with `stale: true` flag.
 *
 * Note: This queries the database cache. For fetching fresh data,
 * use `hostingOrchestrationWorkflow` from workflows/hosting-orchestration.
 */
export async function getCachedHosting(
  domain: string,
): Promise<CacheResult<HostingResponse>> {
  const now = Date.now();

  const existingDomain = await findDomainByName(domain);
  if (!existingDomain) {
    return { data: null, stale: false, expiresAt: null };
  }

  const hp = alias(providersTable, "hp");
  const ep = alias(providersTable, "ep");
  const dp = alias(providersTable, "dp");

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
      expiresAt: hostingTable.expiresAt,
    })
    .from(hostingTable)
    .leftJoin(hp, eq(hp.id, hostingTable.hostingProviderId))
    .leftJoin(ep, eq(ep.id, hostingTable.emailProviderId))
    .leftJoin(dp, eq(dp.id, hostingTable.dnsProviderId))
    .where(eq(hostingTable.domainId, existingDomain.id))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, expiresAt: null };
  }

  const { expiresAt } = row;
  const stale = (expiresAt?.getTime?.() ?? 0) <= now;

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
    geo: {
      city: row.geoCity ?? "",
      region: row.geoRegion ?? "",
      country: row.geoCountry ?? "",
      country_code: row.geoCountryCode ?? "",
      lat: row.geoLat ?? null,
      lon: row.geoLon ?? null,
    },
  };

  return { data: result, stale, expiresAt };
}

export async function upsertHosting(params: HostingInsert) {
  await db.insert(hostingTable).values(params).onConflictDoUpdate({
    target: hostingTable.domainId,
    set: params,
  });
}
