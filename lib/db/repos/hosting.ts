import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import {
  hosting as hostingTable,
  providers as providersTable,
} from "@/lib/db/schema";
import type { HostingResponse } from "@/lib/types";
import { findDomainByName } from "./domains";

type HostingInsert = InferInsertModel<typeof hostingTable>;

/**
 * Get cached hosting data for a domain.
 * Returns null if no cached data or cache is expired.
 */
export async function getHostingCached(
  domain: string,
): Promise<HostingResponse | null> {
  const nowMs = Date.now();

  const existingDomain = await findDomainByName(domain);
  if (!existingDomain) {
    return null;
  }

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

  if (!row || (row.expiresAt?.getTime?.() ?? 0) <= nowMs) {
    return null;
  }

  return {
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
}

export async function upsertHosting(params: HostingInsert) {
  await db.insert(hostingTable).values(params).onConflictDoUpdate({
    target: hostingTable.domainId,
    set: params,
  });
}
