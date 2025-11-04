import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { httpHeaders } from "@/lib/db/schema";

export type ReplaceHeadersParams = {
  domainId: string;
  headers: Array<{ name: string; value: string }>;
  status: number;
  fetchedAt: Date;
  expiresAt: Date;
};

export async function replaceHeaders(params: ReplaceHeadersParams) {
  const { domainId, headers, status, fetchedAt, expiresAt } = params;

  // Delete all existing headers for this domain
  await db.delete(httpHeaders).where(eq(httpHeaders.domainId, domainId));

  // Normalize incoming header names (trim + lowercase) and insert all
  if (headers.length > 0) {
    const values = headers.map((h) => ({
      domainId,
      name: h.name.trim().toLowerCase(),
      value: h.value,
      status,
      fetchedAt,
      expiresAt,
    }));

    await db.insert(httpHeaders).values(values);
  }
}
