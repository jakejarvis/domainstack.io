import type { Browser, Page } from "puppeteer-core";
import { RetryableError } from "workflow";
import { checkBlocklist } from "@/workflows/shared/check-blocklist";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const NAV_TIMEOUT_MS = 8000;
const IDLE_TIME_MS = 500;
const IDLE_TIMEOUT_MS = 3000;
const MAX_ATTEMPTS = 3;

export interface ScreenshotWorkflowInput {
  domain: string;
}

export interface ScreenshotWorkflowData {
  url: string | null;
  blocked?: boolean;
}

export type ScreenshotWorkflowResult =
  | {
      success: true;
      data: ScreenshotWorkflowData;
    }
  | {
      success: false;
      error: "capture_error" | "not_found" | "blocked_domain";
      data: ScreenshotWorkflowData | null;
    };

// Internal types for capture result
interface CaptureSuccess {
  success: true;
  imageBuffer: string; // base64 encoded for serialization
  source: "direct_https" | "direct_http";
}

interface CaptureFailure {
  success: false;
  isPermanentFailure: boolean;
}

type CaptureResult = CaptureSuccess | CaptureFailure;

/**
 * Durable screenshot workflow that breaks down screenshot generation into
 * independently retryable steps:
 * 1. Check blocklist
 * 2. Capture screenshot (Puppeteer)
 * 3. Process and store image (Vercel Blob)
 * 4. Persist to database
 */
export async function screenshotWorkflow(
  input: ScreenshotWorkflowInput,
): Promise<ScreenshotWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Check if domain is blocked (shared step)
  const isBlocked = await checkBlocklist(domain, "screenshot-workflow");

  if (isBlocked) {
    return {
      success: true,
      data: { url: null, blocked: true },
    };
  }

  // Step 2: Capture screenshot using Puppeteer
  // This is the heavy operation that benefits most from durability
  const captureResult = await captureScreenshot(domain);

  if (!captureResult.success) {
    // Step 3a: Persist failure to cache
    await persistFailure(domain, captureResult.isPermanentFailure);
    return {
      success: false,
      error: "capture_error",
      data: { url: null },
    };
  }

  // Step 3b: Process and store image to Vercel Blob
  const storageResult = await storeScreenshot(
    domain,
    captureResult.imageBuffer,
    captureResult.source,
  );

  // Step 4: Persist to database
  await persistSuccess(
    domain,
    storageResult.url,
    storageResult.pathname,
    storageResult.source,
  );

  return {
    success: true,
    data: { url: storageResult.url },
  };
}

/**
 * Step: Capture screenshot using Puppeteer
 * This is the heavy operation that benefits from workflow durability
 */
async function captureScreenshot(domain: string): Promise<CaptureResult> {
  "use step";

  const { getBrowser } = await import("@/lib/puppeteer");
  const { USER_AGENT } = await import("@/lib/constants/app");
  const { optimizeImageCover } = await import("@/lib/image");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "screenshot-workflow" });
  const urls = [`https://${domain}`, `http://${domain}`];
  const permanentFailureUrls = new Set<string>();

  let browser: Browser | null = null;

  try {
    browser = await getBrowser();

    for (const url of urls) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let page: Page | null = null;

        try {
          page = await browser.newPage();

          await page.setViewport({
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT,
            deviceScaleFactor: 1,
          });
          await page.setUserAgent(USER_AGENT);

          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: NAV_TIMEOUT_MS,
          });

          // Check for permanent failure signals (404, 410 Gone, etc.)
          if (response) {
            const status = response.status();
            if (status === 404 || status === 410) {
              permanentFailureUrls.add(url);
              break; // No point retrying this specific URL
            }
          }

          try {
            await page.waitForNetworkIdle({
              idleTime: IDLE_TIME_MS,
              timeout: IDLE_TIMEOUT_MS,
            });
          } catch {
            // Network idle timeout is not critical
          }

          const rawPng = (await page.screenshot({
            type: "png",
            fullPage: false,
          })) as Buffer;

          const optimized = await optimizeImageCover(
            rawPng,
            VIEWPORT_WIDTH,
            VIEWPORT_HEIGHT,
          );

          if (!optimized || optimized.length === 0) {
            continue;
          }

          const source = url.startsWith("https://")
            ? ("direct_https" as const)
            : ("direct_http" as const);

          // Encode as base64 for serialization between steps
          return {
            success: true,
            imageBuffer: optimized.toString("base64"),
            source,
          };
        } catch (err) {
          logger.debug(
            { err, domain, url, attempt: attempt + 1 },
            "screenshot capture attempt failed",
          );

          // Exponential backoff for retries
          if (attempt < MAX_ATTEMPTS - 1) {
            const delay = Math.min(200 * 2 ** attempt, 1200);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        } finally {
          if (page) {
            try {
              await page.close();
            } catch (err) {
              logger.error({ err, domain }, "failed to close page");
            }
          }
        }
      }
    }

    // All attempts failed
    const isPermanentFailure =
      permanentFailureUrls.size === urls.length && urls.length > 0;

    return {
      success: false,
      isPermanentFailure,
    };
  } catch (err) {
    // Outer errors (browser init failures, etc.) are transient - throw to retry
    logger.warn({ err, domain }, "screenshot capture failed, will retry");
    throw new RetryableError("Screenshot capture failed", {
      retryAfter: "10s",
    });
  }
}

/**
 * Step: Store screenshot to Vercel Blob
 */
async function storeScreenshot(
  domain: string,
  imageBufferBase64: string,
  source: "direct_https" | "direct_http",
): Promise<{
  url: string;
  pathname: string | null;
  source: "direct_https" | "direct_http";
}> {
  "use step";

  const { addWatermarkToScreenshot } = await import("@/lib/image");
  const { storeImage } = await import("@/lib/storage");

  // Decode base64 back to Buffer
  const imageBuffer = Buffer.from(imageBufferBase64, "base64");

  // Apply watermark
  const withWatermark = await addWatermarkToScreenshot(
    imageBuffer,
    VIEWPORT_WIDTH,
    VIEWPORT_HEIGHT,
  );

  // Store to Vercel Blob
  const { url, pathname } = await storeImage({
    kind: "screenshot",
    domain,
    buffer: withWatermark,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });

  return { url, pathname: pathname ?? null, source };
}

/**
 * Step: Persist successful screenshot to database
 */
async function persistSuccess(
  domain: string,
  url: string,
  pathname: string | null,
  source: "direct_https" | "direct_http",
): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertScreenshot } = await import("@/lib/db/repos/screenshots");
  const { ttlForScreenshot } = await import("@/lib/ttl");

  const domainRecord = await ensureDomainRecord(domain);
  const now = new Date();
  const expiresAt = ttlForScreenshot(now);

  await upsertScreenshot({
    domainId: domainRecord.id,
    url,
    pathname,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    source,
    notFound: false,
    fetchedAt: now,
    expiresAt,
  });
}

/**
 * Step: Persist failure to database cache
 */
async function persistFailure(
  domain: string,
  isPermanentFailure: boolean,
): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@/lib/db/repos/domains");
  const { upsertScreenshot } = await import("@/lib/db/repos/screenshots");
  const { ttlForScreenshot } = await import("@/lib/ttl");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "screenshot-workflow" });

  try {
    const domainRecord = await ensureDomainRecord(domain);
    const now = new Date();
    const expiresAt = ttlForScreenshot(now);

    await upsertScreenshot({
      domainId: domainRecord.id,
      url: null,
      pathname: null,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      source: null,
      notFound: isPermanentFailure,
      fetchedAt: now,
      expiresAt,
    });
  } catch (err) {
    logger.error({ err, domain }, "failed to persist screenshot failure");
  }
}
