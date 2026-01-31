import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../client";
import { screenshots } from "../schema";

type ScreenshotInsert = InferInsertModel<typeof screenshots>;
type Screenshot = InferSelectModel<typeof screenshots>;

export async function upsertScreenshot(
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
}

/**
 * Fetch screenshot record for a domain, returning null if expired or not found.
 */
export async function getScreenshotByDomainId(domainId: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(screenshots)
    .where(
      and(eq(screenshots.domainId, domainId), gt(screenshots.expiresAt, now)),
    )
    .limit(1);
  return rows[0] ?? null;
}
