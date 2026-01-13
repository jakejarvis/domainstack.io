import { FatalError, RetryableError } from "workflow";
import type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsTxt,
  SeoResponse,
  TwitterMeta,
} from "@/lib/types/domain/seo";
import { checkBlocklist } from "@/workflows/shared/check-blocklist";

export interface SeoWorkflowInput {
  domain: string;
}

export type SeoWorkflowResult =
  | {
      success: true;
      data: SeoResponse;
    }
  | {
      success: false;
      error: string;
      data: SeoResponse | null;
    };

// Internal types for step-to-step transfer
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
  shouldRetry?: boolean;
}

interface RobotsFetchResult {
  robots: RobotsTxt | null;
  error?: string;
}

/**
 * Durable SEO workflow that breaks down SEO data fetching into
 * independently retryable steps:
 * 1. Fetch HTML and parse meta tags
 * 2. Fetch and parse robots.txt
 * 3. Fetch and store OG image (if present)
 * 4. Persist to database (creates domain record if needed)
 */
export async function seoWorkflow(
  input: SeoWorkflowInput,
): Promise<SeoWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Fetch HTML and parse meta
  const htmlResult = await fetchHtmlStep(domain);

  // Step 2: Fetch robots.txt
  const robotsResult = await fetchRobotsStep(domain);

  // Step 3: Process OG image (if present and not blocked)
  let uploadedImageUrl: string | null = null;
  if (htmlResult.preview?.image) {
    // Step 3a: Check blocklist (shared step)
    const isBlocked = await checkBlocklist(domain);

    if (!isBlocked) {
      // Step 3b: Process and store image
      const imageResult = await processOgImageStep(
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

  // Step 4: Persist to database
  await persistSeoStep(domain, response, uploadedImageUrl);

  return {
    success: true,
    data: response,
  };
}

/**
 * Step: Fetch HTML and parse meta tags
 */
async function fetchHtmlStep(domain: string): Promise<HtmlFetchResult> {
  "use step";

  const { fetchHtmlMeta } = await import("@/lib/domain/seo-lookup");

  const result = await fetchHtmlMeta(domain);

  if (result.shouldRetry) {
    throw new RetryableError("HTML fetch failed", { retryAfter: "5s" });
  }

  return result;
}

/**
 * Step: Fetch and parse robots.txt
 */
async function fetchRobotsStep(domain: string): Promise<RobotsFetchResult> {
  "use step";

  const { fetchRobotsTxt } = await import("@/lib/domain/seo-lookup");
  return fetchRobotsTxt(domain);
}

/**
 * Step: Process and store OG image
 */
async function processOgImageStep(
  domain: string,
  imageUrl: string,
  currentUrl: string,
): Promise<{ url: string | null }> {
  "use step";

  const { processOgImageUpload } = await import("@/lib/domain/seo-lookup");
  return processOgImageUpload(domain, imageUrl, currentUrl);
}

/**
 * Step: Persist SEO data to database
 */
async function persistSeoStep(
  domain: string,
  response: SeoResponse,
  uploadedImageUrl: string | null,
): Promise<void> {
  "use step";

  const { persistSeoData } = await import("@/lib/domain/seo-lookup");
  try {
    await persistSeoData(domain, response, uploadedImageUrl);
  } catch (err) {
    throw new FatalError(
      `Failed to persist SEO data for domain ${domain}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
