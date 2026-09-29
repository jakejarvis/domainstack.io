import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, gt, inArray, isNotNull, or } from "drizzle-orm";

import type { ProviderLogoResponse } from "@domainstack/types";

import { db } from "../client";
import { providerLogos } from "../schema";
import type { CacheResult } from "../types";

type ProviderLogoInsert = InferInsertModel<typeof providerLogos>;
type ProviderLogo = InferSelectModel<typeof providerLogos>;

export async function upsertProviderLogo(params: ProviderLogoInsert): Promise<ProviderLogo | null> {
  const rows = await db
    .insert(providerLogos)
    .values(params)
    .onConflictDoUpdate({
      target: providerLogos.providerId,
      set: params,
    })
    .returning();
  return rows[0] ?? null;
}

/**
 * Fetch provider logo record by provider ID with staleness metadata.
 */
export async function getProviderLogo(
  providerId: string,
): Promise<CacheResult<ProviderLogoResponse>> {
  const nowMs = Date.now();
  const [row] = await db
    .select({
      url: providerLogos.url,
      notFound: providerLogos.notFound,
      fetchedAt: providerLogos.fetchedAt,
      expiresAt: providerLogos.expiresAt,
    })
    .from(providerLogos)
    .where(eq(providerLogos.providerId, providerId))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  const isDefinitiveResult = row.url !== null || row.notFound;

  if (!isDefinitiveResult) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  const { fetchedAt, expiresAt } = row;
  const stale = expiresAt.getTime() <= nowMs;

  return {
    data: { url: row.url },
    stale,
    fetchedAt,
    expiresAt,
  };
}

/**
 * Fresh, definitive provider logo URLs for many providers in one query, keyed by provider id.
 * A provider is absent from the map when it has no fresh definitive row; `null` means
 * "known to have no logo".
 */
export async function getFreshProviderLogoUrls(
  providerIds: string[],
): Promise<Map<string, string | null>> {
  if (providerIds.length === 0) return new Map();
  const rows = await db
    .select({ providerId: providerLogos.providerId, url: providerLogos.url })
    .from(providerLogos)
    .where(
      and(
        inArray(providerLogos.providerId, providerIds),
        gt(providerLogos.expiresAt, new Date()),
        or(isNotNull(providerLogos.url), eq(providerLogos.notFound, true)),
      ),
    );
  return new Map(rows.map((row) => [row.providerId, row.url]));
}
