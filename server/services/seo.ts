import { eq } from "drizzle-orm";
import { after } from "next/server";
import { USER_AGENT } from "@/lib/constants/app";
import { db } from "@/lib/db/client";
import { findDomainByName } from "@/lib/db/repos/domains";
import { upsertSeo } from "@/lib/db/repos/seo";
import { seo as seoTable } from "@/lib/db/schema";
import { fetchRemoteAsset } from "@/lib/fetch-remote-asset";
import { optimizeImageCover } from "@/lib/image";
import { createLogger } from "@/lib/logger/server";
import { scheduleRevalidation } from "@/lib/schedule";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@/lib/schemas";
import { parseHtmlMeta, parseRobotsTxt, selectPreview } from "@/lib/seo";
import { storeImage } from "@/lib/storage";
import { ttlForSeo } from "@/lib/ttl";

const logger = createLogger({ source: "seo" });

const SOCIAL_WIDTH = 1200;
const SOCIAL_HEIGHT = 630;
const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export type ServiceOptions = {
  skipScheduling?: boolean;
};

export async function getSeo(
  domain: string,
  options: ServiceOptions = {},
): Promise<SeoResponse> {
  // Input domain is already normalized to registrable domain by router schema
  logger.debug("start", { domain });

  // Generate single timestamp for access tracking and scheduling
  const now = new Date();
  const nowMs = now.getTime();

  // Fast path: Check Postgres for cached SEO data
  const existingDomain = await findDomainByName(domain);
  const existing = existingDomain
    ? await db
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
        .where(eq(seoTable.domainId, existingDomain.id))
    : ([] as Array<{
        sourceFinalUrl: string | null;
        sourceStatus: number | null;
        metaOpenGraph: OpenGraphMeta;
        metaTwitter: TwitterMeta;
        metaGeneral: GeneralMeta;
        previewTitle: string | null;
        previewDescription: string | null;
        previewImageUrl: string | null;
        previewImageUploadedUrl: string | null;
        canonicalUrl: string | null;
        robots: RobotsTxt;
        errors: Record<string, unknown>;
        expiresAt: Date | null;
      }>);
  if (existing[0] && (existing[0].expiresAt?.getTime?.() ?? 0) > nowMs) {
    const preview = existing[0].canonicalUrl
      ? {
          title: existing[0].previewTitle ?? null,
          description: existing[0].previewDescription ?? null,
          image: existing[0].previewImageUrl ?? null,
          imageUploaded: existing[0].previewImageUploadedUrl ?? null,
          canonicalUrl: existing[0].canonicalUrl,
        }
      : null;

    // Normalize robots: convert empty object to valid RobotsTxt structure
    const robotsData = existing[0].robots as RobotsTxt;
    const normalizedRobots: RobotsTxt =
      robotsData && "fetched" in robotsData
        ? robotsData
        : { fetched: false, groups: [], sitemaps: [] };

    const response: SeoResponse = {
      meta: {
        openGraph: existing[0].metaOpenGraph as OpenGraphMeta,
        twitter: existing[0].metaTwitter as TwitterMeta,
        general: existing[0].metaGeneral as GeneralMeta,
      },
      robots: normalizedRobots,
      preview,
      source: {
        finalUrl: existing[0].sourceFinalUrl ?? null,
        status: existing[0].sourceStatus ?? null,
      },
      errors: existing[0].errors as Record<string, unknown> as {
        html?: string;
        robots?: string;
      },
    };

    // Log if cached data has errors (helps debug issues)
    if (response.errors?.html || response.errors?.robots) {
      logger.warn("returning cached seo with errors", {
        domain,
        htmlError: response.errors.html,
        robotsError: response.errors.robots,
      });
    }

    return response;
  }

  let finalUrl: string = `https://${domain}/`;
  let status: number | null = null;
  let htmlError: string | undefined;
  let robotsError: string | undefined;

  let meta: ReturnType<typeof parseHtmlMeta> | null = null;
  let robots: ReturnType<typeof parseRobotsTxt> | null = null;

  // HTML fetch - allow redirects to any host (except private IPs)
  // since sites commonly redirect to CDNs, subdomains, etc.
  // Truncate at 512KB since we only need <head> for meta tags; Cheerio handles partial HTML fine.
  try {
    const htmlResult = await fetchRemoteAsset({
      url: finalUrl,
      allowHttp: true,
      timeoutMs: 10000,
      maxBytes: 512 * 1024,
      maxRedirects: 5,
      truncateOnLimit: true,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
        "User-Agent": USER_AGENT,
      },
    });

    status = htmlResult.status;
    finalUrl = htmlResult.finalUrl;

    // Check for non-OK status codes
    if (htmlResult.status < 200 || htmlResult.status >= 300) {
      htmlError = `HTTP ${htmlResult.status}`;
    } else {
      const contentType = htmlResult.contentType ?? "";
      if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
        htmlError = `Non-HTML content-type: ${contentType}`;
      } else {
        const html = htmlResult.buffer.toString("utf-8");
        meta = parseHtmlMeta(html, finalUrl);
      }
    }
  } catch (err) {
    // Infrastructure errors (DNS, private IP, etc.) are still thrown
    htmlError = String(err);
    logger.error("html fetch failed", err, { domain, url: finalUrl });
  }

  // robots.txt fetch - also allow any host redirects
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const robotsResult = await fetchRemoteAsset({
      url: robotsUrl,
      allowHttp: true,
      timeoutMs: 8000,
      maxBytes: 256 * 1024,
      maxRedirects: 5,
      headers: { Accept: "text/plain", "User-Agent": USER_AGENT },
    });
    if (robotsResult.status >= 200 && robotsResult.status < 300) {
      const ct = robotsResult.contentType ?? "";
      if (/^text\/(plain|html|xml)?($|;|,)/i.test(ct)) {
        const txt = robotsResult.buffer.toString("utf-8");
        robots = parseRobotsTxt(txt, { baseUrl: robotsUrl });
      } else {
        robotsError = `Unexpected robots content-type: ${ct}`;
      }
    } else {
      robotsError = `HTTP ${robotsResult.status}`;
    }
  } catch (err) {
    robotsError = String(err);
  }

  const preview = meta ? selectPreview(meta, finalUrl) : null;

  // If a social preview image is present, store a cached copy via Vercel Blob for privacy
  let uploadedImageUrl: string | null = null;

  if (preview?.image) {
    try {
      // Always proxy OG images through Blob storage so we control caching/privacy.
      const asset = await fetchRemoteAsset({
        url: preview.image,
        currentUrl: finalUrl,
        headers: {
          Accept:
            "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.8",
          "User-Agent": USER_AGENT,
        },
        maxBytes: MAX_REMOTE_IMAGE_BYTES,
        timeoutMs: 8000,
        maxRedirects: 3,
      });
      // Skip processing if the image fetch returned non-OK status
      if (asset.status < 200 || asset.status >= 300) {
        throw new Error(`Image fetch returned HTTP ${asset.status}`);
      }
      const optimized = await optimizeImageCover(
        asset.buffer,
        SOCIAL_WIDTH,
        SOCIAL_HEIGHT,
      );
      if (!optimized || optimized.length === 0) {
        throw new Error("Failed to optimize image");
      }
      const { url } = await storeImage({
        kind: "opengraph",
        domain,
        buffer: optimized,
        width: SOCIAL_WIDTH,
        height: SOCIAL_HEIGHT,
      });
      uploadedImageUrl = url;
      preview.imageUploaded = url;
    } catch (err) {
      logger.warn("OG image processing failed", err, {
        domain,
        image: preview.image,
      });
      preview.imageUploaded = null;
    }
  }

  const response: SeoResponse = {
    meta,
    robots,
    preview,
    source: { finalUrl, status },
    ...(htmlError || robotsError
      ? {
          errors: {
            ...(htmlError ? { html: htmlError } : {}),
            ...(robotsError ? { robots: robotsError } : {}),
          },
        }
      : {}),
  };

  // Persist to Postgres only if domain exists (i.e., is registered)
  const expiresAt = ttlForSeo(now);

  if (existingDomain) {
    await upsertSeo({
      domainId: existingDomain.id,
      sourceFinalUrl: response.source.finalUrl ?? null,
      sourceStatus: response.source.status ?? null,
      metaOpenGraph: response.meta?.openGraph ?? ({} as OpenGraphMeta),
      metaTwitter: response.meta?.twitter ?? ({} as TwitterMeta),
      metaGeneral: response.meta?.general ?? ({} as GeneralMeta),
      previewTitle: response.preview?.title ?? null,
      previewDescription: response.preview?.description ?? null,
      previewImageUrl: response.preview?.image ?? null,
      previewImageUploadedUrl: uploadedImageUrl,
      canonicalUrl: response.preview?.canonicalUrl ?? null,
      robots: robots ?? { fetched: false, groups: [], sitemaps: [] },
      robotsSitemaps: response.robots?.sitemaps ?? [],
      errors: response.errors ?? {},
      fetchedAt: now,
      expiresAt,
    });

    if (!options.skipScheduling) {
      after(() =>
        scheduleRevalidation(
          domain,
          "seo",
          expiresAt.getTime(),
          existingDomain.lastAccessedAt ?? null,
        ),
      );
    }
  }

  logger.info("done", {
    domain,
    status: status ?? -1,
    has_meta: !!meta,
    has_robots: !!robots,
    has_errors: !!(htmlError || robotsError),
  });

  return response;
}
