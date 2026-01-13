import "server-only";
import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { seo as seoTable } from "@/lib/db/schema";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@/lib/types/domain/seo";
import { findDomainByName } from "./domains";

type SeoInsert = InferInsertModel<typeof seoTable>;

export async function upsertSeo(params: SeoInsert) {
  await db.insert(seoTable).values(params).onConflictDoUpdate({
    target: seoTable.domainId,
    set: params,
  });
}

/**
 * Get cached SEO data for a domain if fresh.
 * Returns null if cache miss or stale.
 */
export async function getSeoCached(
  domain: string,
): Promise<SeoResponse | null> {
  const nowMs = Date.now();

  const existingDomain = await findDomainByName(domain);

  if (!existingDomain) {
    return null;
  }

  const existing = await db
    .select({
      sourceFinalUrl: seoTable.sourceFinalUrl,
      sourceStatus: seoTable.sourceStatus,
      metaOpenGraph: seoTable.metaOpenGraph,
      metaTwitter: seoTable.metaTwitter,
      metaGeneral: seoTable.metaGeneral,
      previewTitle: seoTable.previewTitle,
      previewDescription: seoTable.previewDescription,
      previewImageUrl: seoTable.previewImageUrl,
      previewImageUploadedUrl: seoTable.previewImageUploadedUrl,
      canonicalUrl: seoTable.canonicalUrl,
      robots: seoTable.robots,
      errors: seoTable.errors,
      expiresAt: seoTable.expiresAt,
    })
    .from(seoTable)
    .where(eq(seoTable.domainId, existingDomain.id));

  const [row] = existing;
  if (!row || (row.expiresAt?.getTime?.() ?? 0) <= nowMs) {
    return null;
  }

  // Check blocklist for cached OG images
  const { isDomainBlocked } = await import("./blocked-domains");
  const blocked =
    row.previewImageUploadedUrl && (await isDomainBlocked(domain));

  const preview = row.canonicalUrl
    ? {
        title: row.previewTitle ?? null,
        description: row.previewDescription ?? null,
        image: row.previewImageUrl ?? null,
        imageUploaded: blocked ? null : row.previewImageUploadedUrl,
        canonicalUrl: row.canonicalUrl,
      }
    : null;

  // Normalize robots
  const robotsData = row.robots as RobotsTxt;
  const normalizedRobots: RobotsTxt =
    robotsData && "fetched" in robotsData
      ? robotsData
      : { fetched: false, groups: [], sitemaps: [] };

  const response: SeoResponse = {
    meta: {
      openGraph: row.metaOpenGraph as OpenGraphMeta,
      twitter: row.metaTwitter as TwitterMeta,
      general: row.metaGeneral as GeneralMeta,
    },
    robots: normalizedRobots,
    preview,
    source: {
      finalUrl: row.sourceFinalUrl ?? null,
      status: row.sourceStatus ?? null,
    },
    errors: row.errors as { html?: string; robots?: string },
  };

  return response;
}
