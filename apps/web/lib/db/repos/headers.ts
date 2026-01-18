import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { domains, httpHeaders } from "@/lib/db/schema";
import { getHttpStatusMessage, normalizeHeaders } from "@/lib/headers-utils";
import type { Header, HeadersResponse } from "@/lib/types/domain/headers";
import type { CacheResult } from "./types";

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
 * Returns data even if expired, with `stale: true` flag.
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
      expiresAt: httpHeaders.expiresAt,
    })
    .from(domains)
    .innerJoin(httpHeaders, eq(httpHeaders.domainId, domains.id))
    .where(eq(domains.name, domain))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, expiresAt: null };
  }

  const { expiresAt } = row;
  const stale = (expiresAt?.getTime?.() ?? 0) <= now;

  // Get status message and normalize headers
  const statusMessage = await getHttpStatusMessage(row.status);
  const normalized = normalizeHeaders(row.headers as Header[]);

  return {
    data: {
      headers: normalized,
      status: row.status,
      statusMessage,
    },
    stale,
    expiresAt,
  };
}
