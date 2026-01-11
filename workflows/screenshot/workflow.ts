import { after } from "next/server";
import { FatalError } from "workflow";
import { checkBlocklist } from "@/workflows/shared/check-blocklist";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;

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
    await persistFailure(domain);
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
  );

  // Step 4: Persist to database
  await persistSuccess(domain, storageResult.url, storageResult.pathname);

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

  const { getBrowser, createPage } = await import("@/lib/puppeteer");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "screenshot-workflow" });

  // Get a browser instance, may reuse an existing one if available
  const browser = await getBrowser();

  let page: import("@/lib/puppeteer").Page | null = null;
  try {
    page = await createPage(browser, `https://${domain}`, {
      viewport: {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      },
    });

    if (!page) {
      throw new FatalError("Failed to create page");
    }

    const imageBuffer = await page.screenshot({
      type: "webp",
      fullPage: false,
      // Encode as base64 for serialization between steps
      encoding: "base64",
    });

    return {
      success: true,
      imageBuffer,
    };
  } catch (err) {
    logger.warn({ err, domain }, "screenshot capture failed, not retrying");
    throw new FatalError("Screenshot capture failed");
  } finally {
    // Close page in background to avoid blocking the workflow
    after(() => page?.close());
  }
}

/**
 * Step: Store screenshot to Vercel Blob
 */
async function storeScreenshot(
  domain: string,
  imageBufferBase64: string,
): Promise<{
  url: string;
  pathname: string | null;
}> {
  "use step";

  const { storeImage } = await import("@/lib/storage");

  // Decode base64 back to Buffer
  const imageBuffer = Buffer.from(imageBufferBase64, "base64");

  // Store to Vercel Blob
  const { url, pathname } = await storeImage({
    kind: "screenshot",
    domain,
    buffer: imageBuffer,
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });

  return { url, pathname: pathname ?? null };
}

/**
 * Step: Persist successful screenshot to database
 */
async function persistSuccess(
  domain: string,
  url: string,
  pathname: string | null,
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
    notFound: false,
    fetchedAt: now,
    expiresAt,
  });
}

/**
 * Step: Persist failure to database cache
 */
async function persistFailure(domain: string): Promise<void> {
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
      notFound: true,
      fetchedAt: now,
      expiresAt,
    });
  } catch (err) {
    logger.error({ err, domain }, "failed to persist screenshot failure");
  }
}
