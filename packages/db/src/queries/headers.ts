import type { Header, HeadersResponse } from "@domainstack/types";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { domains, httpHeaders } from "../schema";
import type { CacheResult } from "../types";

export interface ReplaceHeadersParams {
  domainId: string;
  headers: Array<{ name: string; value: string }>;
  status: number;
  fetchedAt: Date;
  expiresAt: Date;
}

export async function replaceHeaders(params: ReplaceHeadersParams) {
  const { domainId, headers, status, fetchedAt, expiresAt } = params;

  // Normalize incoming header names (trim + lowercase)
  const normalizedHeaders: Header[] = headers.map((h) => ({
    name: h.name.trim().toLowerCase(),
    value: h.value,
  }));

  // Upsert: insert or update if row exists
  await db
    .insert(httpHeaders)
    .values({
      domainId,
      headers: normalizedHeaders,
      status,
      fetchedAt,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: httpHeaders.domainId,
      set: {
        headers: normalizedHeaders,
        status,
        fetchedAt,
        expiresAt,
      },
    });
}

/**
 * Get cached headers for a domain with staleness metadata.
 * Returns raw data - consumers should enrich with status messages.
 *
 * Note: This queries the database cache. For fetching fresh data,
 * use `fetchHeadersStep` from workflows/shared/headers.
 *
 * Optimized: Uses a single query with JOIN to fetch domain and headers,
 * reducing from 2 round trips to 1.
 */
export async function getCachedHeaders(
  domain: string,
): Promise<CacheResult<HeadersResponse>> {
  const now = Date.now();

  // Single query: JOIN domains -> httpHeaders
  const [row] = await db
    .select({
      headers: httpHeaders.headers,
      status: httpHeaders.status,
      fetchedAt: httpHeaders.fetchedAt,
      expiresAt: httpHeaders.expiresAt,
    })
    .from(domains)
    .innerJoin(httpHeaders, eq(httpHeaders.domainId, domains.id))
    .where(eq(domains.name, domain))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, fetchedAt: null, expiresAt: null };
  }

  const { fetchedAt, expiresAt } = row;
  const stale = (expiresAt?.getTime?.() ?? 0) <= now;

  // Return raw data - consumers should normalize headers and get status messages
  return {
    data: {
      headers: row.headers as Header[],
      status: row.status,
      statusMessage: undefined,
    },
    stale,
    fetchedAt,
    expiresAt,
  };
}
