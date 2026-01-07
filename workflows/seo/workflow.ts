import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@/lib/types";

export interface SeoWorkflowInput {
  domain: string;
}

export interface SeoWorkflowResult {
  success: boolean;
  data: SeoResponse;
}

// Internal types for step-to-step transfer
interface DomainInfo {
  domainId: string | null;
  lastAccessedAt: Date | null;
}

interface HtmlFetchResult {
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

interface RobotsFetchResult {
  robots: RobotsTxt | null;
  error?: string;
}

const SOCIAL_WIDTH = 1200;
const SOCIAL_HEIGHT = 630;

/**
 * Durable SEO workflow that breaks down SEO data fetching into
 * independently retryable steps:
 * 1. Get domain info (for persistence)
 * 2. Fetch HTML and parse meta tags
 * 3. Fetch and parse robots.txt
 * 4. Fetch and store OG image (if present)
 * 5. Persist to database
 */
export async function seoWorkflow(
  input: SeoWorkflowInput,
): Promise<SeoWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Get domain info
  const domainInfo = await getDomainInfo(domain);

  // Step 2: Fetch HTML and parse meta
  const htmlResult = await fetchHtml(domain);

  // Step 3: Fetch robots.txt
  const robotsResult = await fetchRobots(domain);

  // Step 4: Process OG image (if present and not blocked)
  let uploadedImageUrl: string | null = null;
  if (htmlResult.preview?.image) {
    const imageResult = await processOgImage(
      domain,
      htmlResult.preview.image,
      htmlResult.finalUrl,
    );
    uploadedImageUrl = imageResult.url;
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

  // Step 5: Persist to database
  if (domainInfo.domainId) {
    await persistSeo(
      domainInfo.domainId,
      response,
      uploadedImageUrl,
      domainInfo.lastAccessedAt?.toISOString() ?? null,
      domain,
    );
  }

  return {
    success: true,
    data: response,
  };
}

/**
 * Step: Get domain info for persistence
 */
async function getDomainInfo(domain: string): Promise<DomainInfo> {
  "use step";

  const { findDomainByName } = await import("@/lib/db/repos/domains");

  try {
    const existingDomain = await findDomainByName(domain);

    if (!existingDomain) {
      return { domainId: null, lastAccessedAt: null };
    }

    return {
      domainId: existingDomain.id,
      lastAccessedAt: existingDomain.lastAccessedAt,
    };
  } catch {
    return { domainId: null, lastAccessedAt: null };
  }
}

/**
 * Step: Fetch HTML and parse meta tags
 */
async function fetchHtml(domain: string): Promise<HtmlFetchResult> {
  "use step";

  const { fetchRemoteAsset } = await import("@/lib/fetch-remote-asset");
  const { parseHtmlMeta, selectPreview } = await import("@/lib/seo");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "seo-workflow" });
  let finalUrl = `https://${domain}/`;
  let status: number | null = null;

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
    logger.debug({ err, domain }, "HTML fetch failed");
    return {
      success: false,
      finalUrl,
      status,
      meta: null,
      preview: null,
    };
  }
}

/**
 * Step: Fetch and parse robots.txt
 */
async function fetchRobots(domain: string): Promise<RobotsFetchResult> {
  "use step";

  const { fetchRemoteAsset } = await import("@/lib/fetch-remote-asset");
  const { parseRobotsTxt } = await import("@/lib/seo");
  const { isExpectedTlsError } = await import("@/lib/fetch");
  const { USER_AGENT } = await import("@/lib/constants/app");

  const robotsUrl = `https://${domain}/robots.txt`;

  try {
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
 * Step: Process and store OG image
 */
async function processOgImage(
  domain: string,
  imageUrl: string,
  currentUrl: string,
): Promise<{ url: string | null }> {
  "use step";

  const { isDomainBlocked } = await import("@/lib/db/repos/blocked-domains");
  const { fetchRemoteAsset } = await import("@/lib/fetch-remote-asset");
  const { optimizeImageCover } = await import("@/lib/image");
  const { storeImage } = await import("@/lib/storage");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "seo-workflow" });

  // Check blocklist first
  if (await isDomainBlocked(domain)) {
    return { url: null };
  }

  try {
    const asset = await fetchRemoteAsset({
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
 * Step: Persist SEO data to database
 */
async function persistSeo(
  domainId: string,
  response: SeoResponse,
  uploadedImageUrl: string | null,
  lastAccessedAt: string | null,
  domain: string,
): Promise<void> {
  "use step";

  const { upsertSeo } = await import("@/lib/db/repos/seo");
  const { scheduleRevalidation } = await import("@/lib/schedule");
  const { ttlForSeo } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "seo-workflow" });
  const now = new Date();
  const expiresAt = ttlForSeo(now);

  try {
    await upsertSeo({
      domainId,
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
      expiresAt.getTime(),
      lastAccessedAt ? new Date(lastAccessedAt) : null,
    );

    logger.debug({ domain }, "SEO data persisted");
  } catch (err) {
    logger.error({ err, domain }, "failed to persist SEO data");
    // Don't throw - persistence failure shouldn't fail the workflow
  }
}
