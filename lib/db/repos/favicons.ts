import "server-only";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { domains, favicons } from "@/lib/db/schema";

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

/**
 * Fetch favicon record by domain name (optimized with JOIN).
 * Returns null if domain not found, favicon expired, or not yet generated.
 */
export async function getFaviconByDomain(domainName: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(favicons)
    .innerJoin(domains, eq(favicons.domainId, domains.id))
    .where(and(eq(domains.name, domainName), gt(favicons.expiresAt, now)))
    .limit(1);
  return rows[0]?.favicons ?? null;
}
