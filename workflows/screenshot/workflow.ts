import "server-only";
import { step } from "workflow";
import type { Browser, Page } from "puppeteer-core";
import { USER_AGENT } from "@/lib/constants/app";
import { isDomainBlocked } from "@/lib/db/repos/blocked-domains";
import { ensureDomainRecord, findDomainByName } from "@/lib/db/repos/domains";
import {
  getScreenshotByDomainId,
  upsertScreenshot,
} from "@/lib/db/repos/screenshots";
import { addWatermarkToScreenshot, optimizeImageCover } from "@/lib/image";
import { createLogger } from "@/lib/logger/server";
import { getBrowser } from "@/lib/puppeteer";
import { storeImage } from "@/lib/storage";
import { ttlForScreenshot } from "@/lib/ttl";

const logger = createLogger({ source: "screenshot-workflow" });

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const NAV_TIMEOUT_MS = 8000;
const IDLE_TIME_MS = 500;
const IDLE_TIMEOUT_MS = 3000;

export interface ScreenshotWorkflowInput {
  domain: string;
}

export interface ScreenshotWorkflowResult {
  url: string | null;
  blocked: boolean;
  cached: boolean;
}

/**
 * Durable screenshot workflow that breaks down screenshot generation into
 * independently retryable steps:
 * 1. Check blocklist
 * 2. Check cache (Postgres)
 * 3. Capture screenshot (Puppeteer)
 * 4. Process and store image (Vercel Blob)
 * 5. Persist to database
 */
export async function screenshotWorkflow(
  input: ScreenshotWorkflowInput,
): Promise<ScreenshotWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Check if domain is blocked
  const isBlocked = await step.run("check-blocklist", async () => {
    return await isDomainBlocked(domain);
  });

  if (isBlocked) {
    logger.info({ domain }, "screenshot blocked by blocklist");
    return { url: null, blocked: true, cached: false };
  }

  // Step 2: Check cache in Postgres
  const cachedResult = await step.run("check-cache", async () => {
    const existingDomain = await findDomainByName(domain);
    if (!existingDomain) {
      return null;
    }

    const screenshotRecord = await getScreenshotByDomainId(existingDomain.id);
    if (!screenshotRecord) {
      return null;
    }

    // Only treat as cache hit if we have a definitive result:
    // - url is present (string), OR
    // - url is null but marked as permanently not found
    const isDefinitiveResult =
      screenshotRecord.url !== null || screenshotRecord.notFound === true;

    if (isDefinitiveResult) {
      return { url: screenshotRecord.url };
    }

    return null;
  });

  if (cachedResult) {
    return { url: cachedResult.url, blocked: false, cached: true };
  }

  // Step 3: Capture screenshot using Puppeteer
  // This is the heavy operation that benefits most from durability
  const captureResult = await step.run("capture-screenshot", async () => {
    return await captureScreenshotWithRetry(domain);
  });

  if (!captureResult.success) {
    // Step 4a: Persist failure to cache
    await step.run("persist-failure", async () => {
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
        notFound: captureResult.isPermanentFailure,
        fetchedAt: now,
        expiresAt,
      });
    });

    return { url: null, blocked: false, cached: false };
  }

  // Step 4b: Process and store image to Vercel Blob
  const storageResult = await step.run("store-image", async () => {
    // Apply watermark
    const withWatermark = await addWatermarkToScreenshot(
      captureResult.imageBuffer,
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

    return { url, pathname: pathname ?? null, source: captureResult.source };
  });

  // Step 5: Persist to database
  await step.run("persist-to-db", async () => {
    const domainRecord = await ensureDomainRecord(domain);
    const now = new Date();
    const expiresAt = ttlForScreenshot(now);

    await upsertScreenshot({
      domainId: domainRecord.id,
      url: storageResult.url,
      pathname: storageResult.pathname,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      source: storageResult.source,
      notFound: false,
      fetchedAt: now,
      expiresAt,
    });
  });

  return { url: storageResult.url, blocked: false, cached: false };
}

// Internal types for capture result
interface CaptureSuccess {
  success: true;
  imageBuffer: Buffer;
  source: "direct_https" | "direct_http";
  isPermanentFailure: false;
}

interface CaptureFailure {
  success: false;
  imageBuffer?: undefined;
  source?: undefined;
  isPermanentFailure: boolean;
}

type CaptureResult = CaptureSuccess | CaptureFailure;

/**
 * Captures a screenshot with retry logic.
 * This function is designed to run within a workflow step.
 */
async function captureScreenshotWithRetry(domain: string): Promise<CaptureResult> {
  const MAX_ATTEMPTS = 3;
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

          return {
            success: true,
            imageBuffer: optimized,
            source,
            isPermanentFailure: false,
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
    logger.error({ err, domain }, "screenshot capture failed");
    return {
      success: false,
      isPermanentFailure: false,
    };
  }
}
