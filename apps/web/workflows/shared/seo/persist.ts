/**
 * SEO persist step.
 *
 * Persists SEO data to the database.
 * This step is shared between the dedicated seoWorkflow and internal workflows.
 *
 * Note: This step only handles database persistence. Revalidation scheduling
 * should be done at the workflow level using scheduleRevalidationBatchStep.
 */

import type {
  GeneralMeta,
  OpenGraphMeta,
  SeoResponse,
  TwitterMeta,
} from "@/lib/types/domain/seo";
import type { PersistResult } from "@/lib/workflow/types";

/**
 * Step: Persist SEO data to database.
 *
 * Creates domain record if needed. Returns lastAccessedAt for use in
 * scheduling revalidation at the workflow level.
 *
 * @param domain - The domain name
 * @param response - The SEO response to persist
 * @param uploadedImageUrl - Optional uploaded OG image URL
 * @returns Object with lastAccessedAt for scheduling
 */
export async function persistSeoStep(
  domain: string,
  response: SeoResponse,
  uploadedImageUrl: string | null,
): Promise<PersistResult> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { ttlForSeo } = await import("@/lib/ttl");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertSeo } = await import("@/lib/db/repos/seo");

  const now = new Date();
  const expiresAt = ttlForSeo(now);

  try {
    const domainRecord = await ensureDomainRecord(domain);

    // Empty objects satisfy the meta interfaces since all properties are optional
    const emptyOpenGraph: OpenGraphMeta = {};
    const emptyTwitter: TwitterMeta = {};
    const emptyGeneral: GeneralMeta = {};

    await upsertSeo({
      domainId: domainRecord.id,
      sourceFinalUrl: response.source.finalUrl ?? null,
      sourceStatus: response.source.status ?? null,
      metaOpenGraph: response.meta?.openGraph ?? emptyOpenGraph,
      metaTwitter: response.meta?.twitter ?? emptyTwitter,
      metaGeneral: response.meta?.general ?? emptyGeneral,
      previewTitle: response.preview?.title ?? null,
      previewDescription: response.preview?.description ?? null,
      previewImageUrl: response.preview?.image ?? null,
      previewImageUploadedUrl: uploadedImageUrl,
      canonicalUrl: response.preview?.canonicalUrl ?? null,
      robots: response.robots ?? { fetched: false, groups: [], sitemaps: [] },
      robotsSitemaps: response.robots?.sitemaps ?? [],
      errors: response.errors ?? {},
      fetchedAt: now,
      expiresAt,
    });

    return { lastAccessedAt: domainRecord.lastAccessedAt ?? null };
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting SEO data for ${domain}`,
    });
  }
}
