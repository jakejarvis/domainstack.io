/**
 * SEO persist step.
 *
 * Persists SEO data to the database.
 * This step is shared between the dedicated seoWorkflow and internal workflows.
 */

import type {
  GeneralMeta,
  OpenGraphMeta,
  SeoResponse,
  TwitterMeta,
} from "@/lib/types/domain/seo";

/**
 * Step: Persist SEO data to database.
 *
 * Creates domain record if needed and schedules revalidation.
 *
 * @param domain - The domain name
 * @param response - The SEO response to persist
 * @param uploadedImageUrl - Optional uploaded OG image URL
 */
export async function persistSeoStep(
  domain: string,
  response: SeoResponse,
  uploadedImageUrl: string | null,
): Promise<void> {
  "use step";

  // Dynamic imports for Node.js modules and database operations
  const { getStepMetadata } = await import("workflow");
  const { createLogger } = await import("@/lib/logger/server");
  const { ttlForSeo } = await import("@/lib/ttl");
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertSeo } = await import("@/lib/db/repos/seo");
  const { scheduleRevalidation } = await import("@/lib/revalidation");

  const { stepId } = getStepMetadata();
  const logger = createLogger({ source: "seo-persist" });
  const now = new Date();
  const expiresAt = ttlForSeo(now);

  try {
    const domainRecord = await ensureDomainRecord(domain);

    await upsertSeo({
      domainId: domainRecord.id,
      sourceFinalUrl: response.source.finalUrl ?? null,
      sourceStatus: response.source.status ?? null,
      metaOpenGraph:
        response.meta?.openGraph ?? ({} as unknown as OpenGraphMeta),
      metaTwitter: response.meta?.twitter ?? ({} as unknown as TwitterMeta),
      metaGeneral: response.meta?.general ?? ({} as unknown as GeneralMeta),
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

    await scheduleRevalidation(
      domain,
      "seo",
      domainRecord.lastAccessedAt ?? null,
    );

    logger.debug({ domain, stepId }, "SEO data persisted");
  } catch (err) {
    const { classifyDatabaseError } = await import("@/lib/workflow/errors");
    throw classifyDatabaseError(err, {
      context: `persisting SEO data for ${domain}`,
    });
  }
}
