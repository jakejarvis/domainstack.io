/**
 * SEO lookup implementation - core logic for SEO data fetching.
 *
 * This module contains the business logic extracted from the SEO workflow.
 * It's used by both the standalone seoWorkflow and shared steps.
 */

import { USER_AGENT } from "@/lib/constants/app";
import { isExpectedDnsError } from "@/lib/dns-utils";
import { optimizeImageCover } from "@/lib/image";
import { createLogger } from "@/lib/logger/server";
import { safeFetch } from "@/lib/safe-fetch";
import { parseHtmlMeta, parseRobotsTxt, selectPreview } from "@/lib/seo";
import { storeImage } from "@/lib/storage";
import { isExpectedTlsError } from "@/lib/tls-utils";
import { ttlForSeo } from "@/lib/ttl";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@/lib/types";

const logger = createLogger({ source: "seo-lookup" });

const SOCIAL_WIDTH = 1200;
const SOCIAL_HEIGHT = 630;

export interface HtmlFetchResult {
  success: boolean;
  finalUrl: string;
  status: number | null;
  meta: {
    openGraph: OpenGraphMeta;
    twitter: TwitterMeta;
    general: GeneralMeta;
  } | null;
  preview: {
    title: string | null;
    description: string | null;
    image: string | null;
    canonicalUrl: string;
  } | null;
  error?: string;
  shouldRetry?: boolean;
}

export interface RobotsFetchResult {
  robots: RobotsTxt | null;
  error?: string;
}

export interface OgImageResult {
  url: string | null;
}

/**
 * Fetch HTML and parse meta tags.
 */
export async function fetchHtmlMeta(domain: string): Promise<HtmlFetchResult> {
  let finalUrl = `https://${domain}/`;
  let status: number | null = null;

  try {
    const htmlResult = await safeFetch({
      url: finalUrl,
      allowHttp: true,
      timeoutMs: 10_000,
      maxBytes: 512 * 1024,
      maxRedirects: 5,
      truncateOnLimit: true,
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
      },
    });

    // biome-ignore lint/nursery/useDestructuring: might be null
    status = htmlResult.status;
    // biome-ignore lint/nursery/useDestructuring: might be null
    finalUrl = htmlResult.finalUrl;

    if (!htmlResult.ok) {
      return {
        success: false,
        finalUrl,
        status,
        meta: null,
        preview: null,
        error: `HTTP ${htmlResult.status}`,
      };
    }

    const contentType = htmlResult.contentType ?? "";
    if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
      return {
        success: false,
        finalUrl,
        status,
        meta: null,
        preview: null,
        error: `Non-HTML content-type: ${contentType}`,
      };
    }

    const html = htmlResult.buffer.toString("utf-8");
    const meta = parseHtmlMeta(html, finalUrl);
    const preview = selectPreview(meta, finalUrl);

    return {
      success: true,
      finalUrl,
      status,
      meta: {
        openGraph: meta.openGraph,
        twitter: meta.twitter,
        general: meta.general,
      },
      preview: preview
        ? {
            title: preview.title,
            description: preview.description,
            image: preview.image,
            canonicalUrl: preview.canonicalUrl,
          }
        : null,
    };
  } catch (err) {
    if (isExpectedDnsError(err)) {
      logger.debug({ err, domain }, "DNS resolution failed");
      return {
        success: false,
        finalUrl,
        status,
        meta: null,
        preview: null,
        error: "DNS resolution failed",
      };
    }

    if (isExpectedTlsError(err)) {
      logger.debug({ err, domain }, "TLS error");
      return {
        success: false,
        finalUrl,
        status,
        meta: null,
        preview: null,
        error: "Invalid SSL certificate",
      };
    }

    logger.warn({ err, domain }, "HTML fetch failed");
    return {
      success: false,
      finalUrl,
      status,
      meta: null,
      preview: null,
      error: String(err),
      shouldRetry: true,
    };
  }
}

/**
 * Fetch and parse robots.txt.
 */
export async function fetchRobotsTxt(
  domain: string,
): Promise<RobotsFetchResult> {
  const robotsUrl = `https://${domain}/robots.txt`;

  try {
    const robotsResult = await safeFetch({
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
        const robots = parseRobotsTxt(txt, { baseUrl: robotsUrl });
        return { robots };
      }
      return { robots: null, error: `Unexpected robots content-type: ${ct}` };
    }

    return { robots: null, error: `HTTP ${robotsResult.status}` };
  } catch (err) {
    const isTlsError = isExpectedTlsError(err);
    if (isTlsError) {
      return { robots: null, error: "Invalid SSL certificate" };
    }
    return { robots: null, error: String(err) };
  }
}

/**
 * Process and store OG image.
 */
export async function processOgImageUpload(
  domain: string,
  imageUrl: string,
  currentUrl: string,
): Promise<OgImageResult> {
  try {
    const asset = await safeFetch({
      url: imageUrl,
      currentUrl,
      headers: {
        Accept:
          "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.8",
      },
      maxBytes: 5 * 1024 * 1024, // 5MB
      timeoutMs: 8000,
      maxRedirects: 3,
    });

    if (!asset.ok) {
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

    return { url };
  } catch (err) {
    logger.warn({ err, domain }, "OG image processing failed");
    return { url: null };
  }
}

/**
 * Persist SEO data to database.
 */
export async function persistSeoData(
  domain: string,
  response: SeoResponse,
  uploadedImageUrl: string | null,
): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForSeo(now);

  // Dynamic imports for database operations
  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertSeo } = await import("@/lib/db/repos/seo");
  const { scheduleRevalidation } = await import("@/lib/schedule");

  const domainRecord = await ensureDomainRecord(domain);

  await upsertSeo({
    domainId: domainRecord.id,
    sourceFinalUrl: response.source.finalUrl ?? null,
    sourceStatus: response.source.status ?? null,
    metaOpenGraph: response.meta?.openGraph ?? ({} as unknown as OpenGraphMeta),
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
    expiresAt.getTime(),
    domainRecord.lastAccessedAt ?? null,
  );

  logger.debug({ domain }, "SEO data persisted");
}

/**
 * Full SEO lookup and persist in one operation.
 *
 * This is the main entry point for shared steps.
 */
export async function lookupAndPersistSeo(
  domain: string,
): Promise<SeoResponse | null> {
  // Fetch HTML and parse meta
  const htmlResult = await fetchHtmlMeta(domain);

  if (htmlResult.shouldRetry) {
    return null; // Caller should retry
  }

  // Fetch robots.txt
  const robotsResult = await fetchRobotsTxt(domain);

  // Process OG image (if present and not blocked)
  let uploadedImageUrl: string | null = null;
  if (htmlResult.preview?.image) {
    const { isDomainBlocked } = await import("@/lib/db/repos/blocked-domains");
    const isBlocked = await isDomainBlocked(domain);
    if (!isBlocked) {
      const imageResult = await processOgImageUpload(
        domain,
        htmlResult.preview.image,
        htmlResult.finalUrl,
      );
      uploadedImageUrl = imageResult.url;
    }
  }

  // Build response
  const response: SeoResponse = {
    meta: htmlResult.meta,
    robots: robotsResult.robots,
    preview: htmlResult.preview
      ? {
          ...htmlResult.preview,
          imageUploaded: uploadedImageUrl,
        }
      : null,
    source: {
      finalUrl: htmlResult.finalUrl,
      status: htmlResult.status,
    },
    ...(htmlResult.error || robotsResult.error
      ? {
          errors: {
            ...(htmlResult.error ? { html: htmlResult.error } : {}),
            ...(robotsResult.error ? { robots: robotsResult.error } : {}),
          },
        }
      : {}),
  };

  // Persist
  try {
    await persistSeoData(domain, response, uploadedImageUrl);
  } catch (err) {
    logger.error({ err, domain }, "failed to persist SEO data");
    // Still return the data even if persistence failed
  }

  return response;
}
