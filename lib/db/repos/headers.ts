import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { httpHeaders } from "@/lib/db/schema";
import { normalizeHeaders } from "@/lib/headers-utils";
import type { Header, HeadersResponse } from "@/lib/types/domain/headers";
import { findDomainByName } from "./domains";
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
 */
export async function getHeaders(
  domain: string,
): Promise<CacheResult<HeadersResponse>> {
  const now = Date.now();

  const existingDomain = await findDomainByName(domain);
  if (!existingDomain) {
    return { data: null, stale: false, expiresAt: null };
  }

  const [row] = await db
    .select({
      headers: httpHeaders.headers,
      status: httpHeaders.status,
      expiresAt: httpHeaders.expiresAt,
    })
    .from(httpHeaders)
    .where(eq(httpHeaders.domainId, existingDomain.id))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, expiresAt: null };
  }

  const { expiresAt } = row;
  const stale = (expiresAt?.getTime?.() ?? 0) <= now;

  // Get status message
  let statusMessage: string | undefined;
  try {
    const { getStatusCode } = await import("@readme/http-status-codes");
    const statusInfo = getStatusCode(row.status);
    statusMessage = statusInfo.message;
  } catch {
    statusMessage = undefined;
  }

  // Normalize headers
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
