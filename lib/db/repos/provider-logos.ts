import "server-only";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { providerLogos } from "@/lib/db/schema";
import type { ProviderLogoResponse } from "@/lib/types/domain/icon";
import type { CacheResult } from "./types";

type ProviderLogoInsert = InferInsertModel<typeof providerLogos>;
type ProviderLogo = InferSelectModel<typeof providerLogos>;

export async function upsertProviderLogo(
  params: ProviderLogoInsert,
): Promise<ProviderLogo | null> {
  const rows = await db
    .insert(providerLogos)
    .values(params)
    .onConflictDoUpdate({
      target: providerLogos.providerId,
      set: params,
    })
    .returning();
  return rows[0] ?? null;
}

/**
 * Fetch provider logo record by provider ID with staleness metadata.
 * Returns data even if expired, with `stale: true` flag.
 */
export async function getProviderLogo(
  providerId: string,
): Promise<CacheResult<ProviderLogoResponse>> {
  const now = new Date();
  const [row] = await db
    .select({
      url: providerLogos.url,
      notFound: providerLogos.notFound,
      expiresAt: providerLogos.expiresAt,
    })
    .from(providerLogos)
    .where(eq(providerLogos.providerId, providerId))
    .limit(1);

  if (!row) {
    return { data: null, stale: false, expiresAt: null };
  }

  // Only treat as having data if we have a definitive result:
  // - url is present (string), OR
  // - url is null but marked as permanently not found
  const isDefinitiveResult = row.url !== null || row.notFound === true;

  if (!isDefinitiveResult) {
    return { data: null, stale: false, expiresAt: null };
  }

  const { expiresAt } = row;
  const stale = expiresAt <= now;

  return {
    data: { url: row.url },
    stale,
    expiresAt,
  };
}
