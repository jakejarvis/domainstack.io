import type { ProviderLogoResponse } from "@domainstack/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { providerLogos } from "../schema";
import type { CacheResult, DbClient } from "../types";

type ProviderLogoInsert = InferInsertModel<typeof providerLogos>;
type ProviderLogo = InferSelectModel<typeof providerLogos>;

export function createProviderLogosRepo(db: DbClient) {
  return {
    async upsertProviderLogo(
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
    },

    /**
     * Fetch provider logo record by provider ID with staleness metadata.
     */
    async getProviderLogo(
      providerId: string,
    ): Promise<CacheResult<ProviderLogoResponse>> {
      const now = new Date();
      const [row] = await db
        .select({
          url: providerLogos.url,
          notFound: providerLogos.notFound,
          fetchedAt: providerLogos.fetchedAt,
          expiresAt: providerLogos.expiresAt,
        })
        .from(providerLogos)
        .where(eq(providerLogos.providerId, providerId))
        .limit(1);

      if (!row) {
        return { data: null, stale: false, fetchedAt: null, expiresAt: null };
      }

      const isDefinitiveResult = row.url !== null || row.notFound === true;

      if (!isDefinitiveResult) {
        return { data: null, stale: false, fetchedAt: null, expiresAt: null };
      }

      const { fetchedAt, expiresAt } = row;
      const stale = expiresAt <= now;

      return {
        data: { url: row.url },
        stale,
        fetchedAt,
        expiresAt,
      };
    },
  };
}

export type ProviderLogosRepo = ReturnType<typeof createProviderLogosRepo>;
