/**
 * SEO fetch steps.
 *
 * Fetches HTML meta, robots.txt, and processes OG images.
 * These steps are shared between the dedicated seoWorkflow and internal workflows.
 */

import { RetryableError } from "workflow";
import type { HtmlFetchData, RobotsFetchData } from "./types";

const SOCIAL_WIDTH = 1200;
const SOCIAL_HEIGHT = 630;

/**
 * Step: Fetch HTML and parse meta tags.
 *
 * @param domain - The domain to fetch
 * @returns HtmlFetchData with meta and preview data
 */
const USER_AGENT =
  process.env.EXTERNAL_USER_AGENT ||
  "domainstack.io/0.1 (+https://domainstack.io)";

export async function fetchHtmlStep(domain: string): Promise<HtmlFetchData> {
  "use step";

  // Dynamic imports for Node.js modules
  const { isExpectedDnsError } = await import("@domainstack/safe-fetch");
  const { safeFetch } = await import("@domainstack/safe-fetch");
  const { parseHtmlMeta, selectPreview } = await import("@/lib/seo");
  const { isExpectedTlsError } = await import("@/lib/tls-utils");

  let finalUrl = `https://${domain}/`;
  let status: number | null = null;

  try {
    const htmlResult = await safeFetch({
      url: finalUrl,
      userAgent: USER_AGENT,
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

    throw new RetryableError("HTML fetch failed", { retryAfter: "5s" });
  }
}

/**
 * Step: Fetch and parse robots.txt.
 *
 * @param domain - The domain to fetch
 * @returns RobotsFetchData with parsed robots.txt
 */
export async function fetchRobotsStep(
  domain: string,
): Promise<RobotsFetchData> {
  "use step";

  // Dynamic imports for Node.js modules
  const { safeFetch } = await import("@domainstack/safe-fetch");
  const { parseRobotsTxt } = await import("@/lib/seo");
  const { isExpectedTlsError } = await import("@/lib/tls-utils");

  const robotsUrl = `https://${domain}/robots.txt`;

  try {
    const robotsResult = await safeFetch({
      url: robotsUrl,
      userAgent: USER_AGENT,
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
    const isTlsError = isExpectedTlsError(err);
    if (isTlsError) {
      return { robots: null, error: "Invalid SSL certificate" };
    }
    return { robots: null, error: String(err) };
  }
}

/**
 * Step: Process and store OG image.
 *
 * @param domain - The domain name
 * @param imageUrl - The OG image URL to fetch
 * @param currentUrl - The current page URL for relative resolution
 * @returns Object with uploaded image URL or null on failure
 */
export async function processOgImageStep(
  domain: string,
  imageUrl: string,
  currentUrl: string,
): Promise<{ url: string | null }> {
  "use step";

  // Dynamic imports for Node.js modules
  const { optimizeImageCover } = await import("@/lib/image");
  const { safeFetch } = await import("@domainstack/safe-fetch");
  const { storeImage } = await import("@/lib/storage");

  try {
    const asset = await safeFetch({
      url: imageUrl,
      userAgent: USER_AGENT,
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
  } catch {
    return { url: null };
  }
}
