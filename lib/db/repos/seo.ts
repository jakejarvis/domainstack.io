import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { seo as seoTable } from "@/lib/db/schema";

type SeoInsert = InferInsertModel<typeof seoTable>;

export async function upsertSeo(params: SeoInsert) {
  await db.insert(seoTable).values(params).onConflictDoUpdate({
    target: seoTable.domainId,
    set: params,
  });
}
