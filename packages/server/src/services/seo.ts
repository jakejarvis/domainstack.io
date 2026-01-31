/**
 * SEO service - fetches and persists SEO data.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * Transient errors throw (for TanStack Query to retry).
 */

import { storeImage } from "@domainstack/blob";
import {
  ensureDomainRecord,
  isDomainBlocked,
  upsertSeo,
} from "@domainstack/db/queries";
import { optimizeImage } from "@domainstack/image";
import { isExpectedDnsError, safeFetch } from "@domainstack/safe-fetch";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@domainstack/types";
import { parseHtmlMeta, parseRobotsTxt, selectPreview } from "../seo";
import { isExpectedTlsError } from "../tls";
import { ttlForSeo } from "../ttl";

// ============================================================================
// Types
// ============================================================================

export type SeoError = "dns_error" | "tls_error";

export type SeoResult =
  | { success: true; data: SeoResponse }
  | { success: false; error: SeoError };

interface HtmlFetchData {
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
}

interface RobotsFetchData {
  robots: RobotsTxt | null;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SOCIAL_WIDTH = 1200;
const SOCIAL_HEIGHT = 630;

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch and persist SEO data for a domain.
 *
 * @param domain - The domain to analyze
 * @returns SEO result with data or error
 *
 * @throws Error on transient failures (network issues) - TanStack Query retries these
 */
export async function fetchSeo(domain: string): Promise<SeoResult> {
  // Step 1 & 2: Fetch HTML and robots.txt in parallel
  const [htmlResult, robotsResult] = await Promise.all([
    fetchHtml(domain),
    fetchRobots(domain),
  ]);

  // Check for permanent HTML failures (DNS/TLS errors)
  // These are fatal - no useful data can be extracted
  // Still persist the error state to prevent repeated retries
  if (!htmlResult.success) {
    if (
      htmlResult.error === "DNS resolution failed" ||
      htmlResult.error === "Invalid SSL certificate"
    ) {
      const errorResponse = buildSeoResponse(htmlResult, robotsResult, null);
      await persistSeo(domain, errorResponse, null);

      const errorCode =
        htmlResult.error === "DNS resolution failed"
          ? "dns_error"
          : "tls_error";
      return { success: false, error: errorCode };
    }
    // Other HTML failures (HTTP errors, non-HTML) continue with partial data
  }

  // Step 3: Process OG image (if present and not blocked)
  let uploadedImageUrl: string | null = null;
  if (htmlResult.preview?.image) {
    const isBlocked = await checkBlocklist(domain);

    if (!isBlocked) {
      uploadedImageUrl = await processOgImage(
        domain,
        htmlResult.preview.image,
        htmlResult.finalUrl,
      );
    }
  }

  // Step 4: Build response
  const response = buildSeoResponse(htmlResult, robotsResult, uploadedImageUrl);

  // Step 5: Persist to database
  await persistSeo(domain, response, uploadedImageUrl);

  return {
    success: true,
    data: response,
  };
}

// ============================================================================
// Internal: Check Blocklist
// ============================================================================

async function checkBlocklist(domain: string): Promise<boolean> {
  return isDomainBlocked(domain);
}

// ============================================================================
// Internal: Fetch HTML
// ============================================================================

async function fetchHtml(domain: string): Promise<HtmlFetchData> {
  let finalUrl = `https://${domain}/`;
  let status: number | null = null;

  try {
    const htmlResult = await safeFetch({
      url: finalUrl,
      userAgent: process.env.EXTERNAL_USER_AGENT,
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
      return {
        success: false,
        finalUrl,
        status,
        meta: null,
        preview: null,
        error: "Invalid SSL certificate",
      };
    }

    // Transient failure - throw for TanStack Query to retry
    throw new Error("HTML fetch failed");
  }
}

// ============================================================================
// Internal: Fetch Robots
// ============================================================================

async function fetchRobots(domain: string): Promise<RobotsFetchData> {
  const robotsUrl = `https://${domain}/robots.txt`;

  try {
    const robotsResult = await safeFetch({
      url: robotsUrl,
      userAgent: process.env.EXTERNAL_USER_AGENT,
      allowHttp: true,
      timeoutMs: 8000,
      maxBytes: 256 * 1024,
      maxRedirects: 5,
      headers: {
        Accept: "text/plain",
      },
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
    // Permanent errors - return error result
    if (isExpectedDnsError(err)) {
      return { robots: null, error: "DNS resolution failed" };
    }
    if (isExpectedTlsError(err)) {
      return { robots: null, error: "Invalid SSL certificate" };
    }
    // Transient failure - return soft error to allow partial results
    // (HTML may have succeeded even if robots.txt failed)
    return { robots: null, error: "Fetch failed" };
  }
}

// ============================================================================
// Internal: Process OG Image
// ============================================================================

async function processOgImage(
  domain: string,
  imageUrl: string,
  currentUrl: string,
): Promise<string | null> {
  try {
    const asset = await safeFetch({
      url: imageUrl,
      userAgent: process.env.EXTERNAL_USER_AGENT,
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
      return null;
    }

    const optimized = await optimizeImage(asset.buffer, {
      width: SOCIAL_WIDTH,
      height: SOCIAL_HEIGHT,
    });

    if (optimized.length === 0) {
      return null;
    }

    const { url } = await storeImage({
      kind: "opengraph",
      domain,
      buffer: optimized,
      width: SOCIAL_WIDTH,
      height: SOCIAL_HEIGHT,
    });

    return url;
  } catch {
    return null;
  }
}

// ============================================================================
// Internal: Build SEO Response
// ============================================================================

function buildSeoResponse(
  htmlData: HtmlFetchData,
  robotsData: RobotsFetchData,
  uploadedImageUrl: string | null,
): SeoResponse {
  return {
    meta: htmlData.meta,
    robots: robotsData.robots,
    preview: htmlData.preview
      ? {
          ...htmlData.preview,
          imageUploaded: uploadedImageUrl,
        }
      : null,
    source: {
      finalUrl: htmlData.finalUrl,
      status: htmlData.status,
    },
    ...(htmlData.error || robotsData.error
      ? {
          errors: {
            ...(htmlData.error ? { html: htmlData.error } : {}),
            ...(robotsData.error ? { robots: robotsData.error } : {}),
          },
        }
      : {}),
  };
}

// ============================================================================
// Internal: Persist SEO
// ============================================================================

async function persistSeo(
  domain: string,
  response: SeoResponse,
  uploadedImageUrl: string | null,
): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForSeo(now);

  const domainRecord = await ensureDomainRecord(domain);

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
}
