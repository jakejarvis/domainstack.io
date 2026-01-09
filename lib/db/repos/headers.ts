import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { httpHeaders } from "@/lib/db/schema";
import { normalizeHeaders } from "@/lib/domain/headers-lookup";
import type { Header, HeadersResponse } from "@/lib/types";
import { findDomainByName } from "./domains";

export type ReplaceHeadersParams = {
  domainId: string;
  headers: Array<{ name: string; value: string }>;
  status: number;
  fetchedAt: Date;
  expiresAt: Date;
};

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
 * Get cached headers for a domain if fresh.
 * Returns null if cache miss or stale.
 */
export async function getHeadersCached(
  domain: string,
): Promise<HeadersResponse | null> {
  const now = Date.now();

  try {
    const existingDomain = await findDomainByName(domain);
    if (!existingDomain) {
      return null;
    }

    const existing = await db
      .select({
        headers: httpHeaders.headers,
        status: httpHeaders.status,
        expiresAt: httpHeaders.expiresAt,
      })
      .from(httpHeaders)
      .where(eq(httpHeaders.domainId, existingDomain.id))
      .limit(1);

    const row = existing[0];
    if (!row || (row.expiresAt?.getTime?.() ?? 0) <= now) {
      return null;
    }

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
      headers: normalized,
      status: row.status,
      statusMessage,
    };
  } catch {
    return null;
  }
}
