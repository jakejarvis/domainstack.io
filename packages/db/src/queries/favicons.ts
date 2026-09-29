import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, gt, inArray, isNotNull, or } from "drizzle-orm";

import type { FaviconResponse } from "@domainstack/types";

import { db } from "../client";
import { domains, favicons } from "../schema";
import type { CacheResult } from "../types";

type FaviconInsert = InferInsertModel<typeof favicons>;
type Favicon = InferSelectModel<typeof favicons>;

export async function upsertFavicon(params: FaviconInsert): Promise<Favicon | null> {
  const rows = await db
    .insert(favicons)
    .values(params)
    .onConflictDoUpdate({
      target: favicons.domainId,
      set: params,
    })
    .returning();
  return rows[0] ?? null;
}

/**
 * Fetch favicon record by domain name with staleness metadata.
 */
export async function getFavicon(domainName: string): Promise<CacheResult<FaviconResponse>> {
  const nowMs = Date.now();
  const [row] = await db
    .select({
      url: favicons.url,
      notFound: favicons.notFound,
      fetchedAt: favicons.fetchedAt,
      expiresAt: favicons.expiresAt,
    })
    .from(favicons)
    .innerJoin(domains, eq(favicons.domainId, domains.id))
    .where(eq(domains.name, domainName))
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
 * Fresh, definitive favicon URLs for many domains in one query, keyed by domain id.
 * A domain is absent from the map when it has no fresh definitive row; `null` means
 * "known to have no favicon".
 */
export async function getFreshFaviconUrls(
  domainIds: string[],
): Promise<Map<string, string | null>> {
  if (domainIds.length === 0) return new Map();
  const rows = await db
    .select({ domainId: favicons.domainId, url: favicons.url })
    .from(favicons)
    .where(
      and(
        inArray(favicons.domainId, domainIds),
        gt(favicons.expiresAt, new Date()),
        or(isNotNull(favicons.url), eq(favicons.notFound, true)),
      ),
    );
  return new Map(rows.map((row) => [row.domainId, row.url]));
}
