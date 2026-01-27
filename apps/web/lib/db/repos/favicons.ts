import "server-only";

import type { FaviconResponse } from "@domainstack/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { domains, favicons } from "@/lib/db/schema";
import type { CacheResult } from "./types";

type FaviconInsert = InferInsertModel<typeof favicons>;
type Favicon = InferSelectModel<typeof favicons>;

export async function upsertFavicon(
  params: FaviconInsert,
): Promise<Favicon | null> {
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
 * Fetch favicon record by domain ID with staleness metadata.
 * Returns data even if expired, with `stale: true` flag.
 */
export async function getFaviconById(
  domainId: string,
): Promise<CacheResult<FaviconResponse>> {
  const now = new Date();
  const [row] = await db
    .select({
      url: favicons.url,
      notFound: favicons.notFound,
      fetchedAt: favicons.fetchedAt,
      expiresAt: favicons.expiresAt,
    })
    .from(favicons)
    .where(eq(favicons.domainId, domainId))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  // Only treat as having data if we have a definitive result:
  // - url is present (string), OR
  // - url is null but marked as permanently not found
  const isDefinitiveResult = row.url !== null || row.notFound === true;

  if (!isDefinitiveResult) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  const { fetchedAt, expiresAt } = row;
  const stale = expiresAt <= now;

  return {
    data: { url: row.url },
    stale,
    fetchedAt,
    expiresAt,
  };
}

/**
 * Fetch favicon record by domain name with staleness metadata.
 * Returns data even if expired, with `stale: true` flag.
 */
export async function getFavicon(
  domainName: string,
): Promise<CacheResult<FaviconResponse>> {
  const now = new Date();
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

  // Only treat as having data if we have a definitive result:
  // - url is present (string), OR
  // - url is null but marked as permanently not found
  const isDefinitiveResult = row.url !== null || row.notFound === true;

  if (!isDefinitiveResult) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  const { fetchedAt, expiresAt } = row;
  const stale = expiresAt <= now;

  return {
    data: { url: row.url },
    stale,
    fetchedAt,
    expiresAt,
  };
}
