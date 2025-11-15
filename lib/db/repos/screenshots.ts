import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { screenshots } from "@/lib/db/schema";
import { ScreenshotInsert as ScreenshotInsertSchema } from "@/lib/db/zod";

type ScreenshotInsert = InferInsertModel<typeof screenshots>;

export async function upsertScreenshot(params: ScreenshotInsert) {
  const insertRow = ScreenshotInsertSchema.parse(params);
  await db.insert(screenshots).values(insertRow).onConflictDoUpdate({
    target: screenshots.domainId,
    set: insertRow,
  });
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
