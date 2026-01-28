import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, gt } from "drizzle-orm";
import { screenshots } from "../schema";
import type { DbClient } from "../types";

type ScreenshotInsert = InferInsertModel<typeof screenshots>;
type Screenshot = InferSelectModel<typeof screenshots>;

export function createScreenshotsRepo(db: DbClient) {
  return {
    async upsertScreenshot(
      params: ScreenshotInsert,
    ): Promise<Screenshot | null> {
      const rows = await db
        .insert(screenshots)
        .values(params)
        .onConflictDoUpdate({
          target: screenshots.domainId,
          set: params,
        })
        .returning();
      return rows[0] ?? null;
    },

    /**
     * Fetch screenshot record for a domain, returning null if expired or not found.
     */
    async getScreenshotByDomainId(domainId: string) {
      const now = new Date();
      const rows = await db
        .select()
        .from(screenshots)
        .where(
          and(
            eq(screenshots.domainId, domainId),
            gt(screenshots.expiresAt, now),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },
  };
}

export type ScreenshotsRepo = ReturnType<typeof createScreenshotsRepo>;
