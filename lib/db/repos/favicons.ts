import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { favicons } from "@/lib/db/schema";
import { FaviconInsert as FaviconInsertSchema } from "@/lib/db/zod";

type FaviconInsert = InferInsertModel<typeof favicons>;

export async function upsertFavicon(params: FaviconInsert) {
  const insertRow = FaviconInsertSchema.parse(params);
  await db.insert(favicons).values(insertRow).onConflictDoUpdate({
    target: favicons.domainId,
    set: insertRow,
  });
}

/**
 * Fetch favicon record for a domain, returning null if expired or not found.
 */
export async function getFaviconByDomainId(domainId: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(favicons)
    .where(and(eq(favicons.domainId, domainId), gt(favicons.expiresAt, now)))
    .limit(1);
  return rows[0] ?? null;
}
