import "server-only";
import { db } from "@/lib/db/client";
import { httpHeaders } from "@/lib/db/schema";
import type { HttpHeader } from "@/lib/schemas";

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
  const normalizedHeaders: HttpHeader[] = headers.map((h) => ({
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
