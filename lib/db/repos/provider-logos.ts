import "server-only";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { providerLogos } from "@/lib/db/schema";

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
 * Fetch provider logo record by provider ID, returning null if expired or not found.
 */
export async function getProviderLogoByProviderId(providerId: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(providerLogos)
    .where(
      and(
        eq(providerLogos.providerId, providerId),
        gt(providerLogos.expiresAt, now),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
