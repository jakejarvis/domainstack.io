/**
 * SEO service - fetches and persists SEO data.
 *
 * Replaces the workflow-based implementation with a simple async function.
 * Transient errors throw; `lookupSection` reports them as `fetch_failed`.
 */

import { isDomainBlocked } from "@domainstack/db/queries/blocked-domains";
import { ensureDomainRecord } from "@domainstack/db/queries/domains";
import { upsertSeo } from "@domainstack/db/queries/seo";
import { optimizeImage, storeImage } from "@domainstack/image";
import { safeFetch } from "@domainstack/safe-fetch";
import { isExpectedDnsError } from "@domainstack/safe-fetch/dns";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@domainstack/types";

import { isDefinitiveNotFoundError, RemoteDataUnavailableError } from "../lib/fetch-errors";
import { ttlForSeo } from "../lib/ttl";
import { isExpectedTlsError } from "../tls/utils";
import { parseHtmlMeta, selectPreview } from "./parse";
import { parseRobotsTxt } from "./robots";

export { extractMetaTagValues, parseHtmlMeta, selectPreview } from "./parse";
export type { ParseRobotsTxtOptions } from "./robots";
export { parseRobotsTxt } from "./robots";
export { resolveUrlMaybe, sanitizeText } from "./utils";

// ============================================================================
// Types
// ============================================================================

export type SeoError = "dns_error" | "tls_error";

export type SeoResult = { success: true; data: SeoResponse } | { success: false; error: SeoError };

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
  /** Human-readable reason, stored in the response. */
  error?: string;
  /** Set for failures no retry can fix; other failures still return partial data. */
  errorCode?: SeoError;
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
 * @throws Error on transient failures (network issues) - `lookupSection` reports these as `fetch_failed`
 */
export async function fetchSeo(domain: string): Promise<SeoResult> {
  // Step 1 & 2: Fetch HTML and robots.txt in parallel
  const [htmlResult, robotsResult] = await Promise.all([fetchHtml(domain), fetchRobots(domain)]);

  // Check for permanent HTML failures (DNS/TLS errors)
  // These are fatal - no useful data can be extracted
  // Still persist the error state to prevent repeated retries
  // Other HTML failures (HTTP errors, non-HTML) continue with partial data
  if (htmlResult.errorCode) {
    const errorResponse = buildSeoResponse(htmlResult, robotsResult, null);
    await persistSeo(domain, errorResponse, null, false);
    return { success: false, error: htmlResult.errorCode };
  }

  // Step 3: Process OG image (if present and not blocked)
  let uploadedImageUrl: string | null = null;
  let retryImage = false;
  if (htmlResult.preview?.image) {
    const isBlocked = await isDomainBlocked(domain);

    if (!isBlocked) {
      const image = await processOgImage(domain, htmlResult.preview.image, htmlResult.finalUrl);
      uploadedImageUrl = image.url;
      retryImage = image.retryable;
    }
  }

  // Step 4: Build response
  const response = buildSeoResponse(htmlResult, robotsResult, uploadedImageUrl);

  // Step 5: Persist to database
  await persistSeo(domain, response, uploadedImageUrl, retryImage);

  return {
    success: true,
    data: response,
  };
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
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en",
      },
    });

    status = htmlResult.status;
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
        errorCode: "dns_error",
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
        errorCode: "tls_error",
      };
    }

    // Transient failure - throw (see `lookupSection`)
    throw new RemoteDataUnavailableError("HTML data unavailable", { cause: err });
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
        const robots = parseRobotsTxt(txt, { baseUrl: robotsResult.finalUrl });
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

/**
 * Fetch, optimize, and store a page's og:image.
 *
 * `retryable` distinguishes a transient failure (timeout, 5xx, storage outage)
 * from a definitive absence (blocked host, 404, undecodable image), so a flaky
 * moment doesn't cache "no image" for a full day.
 */
async function processOgImage(
  domain: string,
  imageUrl: string,
  currentUrl: string,
): Promise<{ url: string | null; retryable: boolean }> {
  let asset;
  try {
    asset = await safeFetch({
      url: imageUrl,
      userAgent: process.env.EXTERNAL_USER_AGENT,
      currentUrl,
      // Pages served over plain http reference plain-http images; the SSRF
      // checks still apply to every hop.
      allowHttp: true,
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,*/*;q=0.8",
      },
      maxBytes: 5 * 1024 * 1024, // 5MB
      timeoutMs: 8000,
      maxRedirects: 3,
    });
  } catch (err) {
    return { url: null, retryable: !isDefinitiveNotFoundError(err) };
  }

  if (!asset.ok) {
    return {
      url: null,
      retryable: asset.status >= 500 || asset.status === 429 || asset.status === 408,
    };
  }

  let optimized;
  try {
    optimized = await optimizeImage(asset.buffer, {
      width: SOCIAL_WIDTH,
      height: SOCIAL_HEIGHT,
    });
  } catch {
    // The bytes aren't a usable image; fetching them again won't change that.
    return { url: null, retryable: false };
  }

  if (optimized.length === 0) {
    return { url: null, retryable: false };
  }

  try {
    const { url } = await storeImage({
      kind: "opengraph",
      domain,
      buffer: optimized,
      width: SOCIAL_WIDTH,
      height: SOCIAL_HEIGHT,
    });
    return { url, retryable: false };
  } catch {
    // A storage outage is ours, not the site's.
    return { url: null, retryable: true };
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
  const response: SeoResponse = {
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
  };

  if (htmlData.error || robotsData.error) {
    const errors: NonNullable<SeoResponse["errors"]> = {};
    if (htmlData.error) errors.html = htmlData.error;
    if (robotsData.error) errors.robots = robotsData.error;
    response.errors = errors;
  }

  return response;
}

// ============================================================================
// Internal: Persist SEO
// ============================================================================

async function persistSeo(
  domain: string,
  response: SeoResponse,
  uploadedImageUrl: string | null,
  retryImage: boolean,
): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForSeo(now, { imageRetry: retryImage });

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
