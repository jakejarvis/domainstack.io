import { getStepMetadata, RetryableError } from "workflow";

import { checkBlocklist } from "@/workflows/shared/check-blocklist";
import { createLogger } from "@domainstack/logger";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
const logger = createLogger({ source: "workflow/screenshot" });

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
  width: number;
  height: number;
}

interface CaptureFailure {
  success: false;
  errorCode: string;
}

type CaptureResult = CaptureSuccess | CaptureFailure;

/**
 * Durable screenshot workflow that breaks down screenshot generation into
 * independently retryable steps:
 * 1. Check blocklist
 * 2. Capture screenshot (Vercel Sandbox)
 * 3. Process and store image (Vercel Blob)
 * 4. Persist to database
 */
export async function screenshotWorkflow(
  input: ScreenshotWorkflowInput,
): Promise<ScreenshotWorkflowResult> {
  "use workflow";

  const { domain } = input;

  // Step 1: Check if domain is blocked (shared step)
  const isBlocked = await checkBlocklist(domain);

  if (isBlocked) {
    return {
      success: true,
      data: { url: null, blocked: true },
    };
  }

  // Step 2: Capture screenshot in an isolated Vercel Sandbox
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
  const storageResult = await storeScreenshot(domain, captureResult.imageBuffer);

  // Step 4: Persist to database
  await persistSuccess(domain, storageResult.url, storageResult.pathname);

  return {
    success: true,
    data: { url: storageResult.url },
  };
}

/**
 * Step: Capture screenshot using Vercel Sandbox
 * This is the heavy operation that benefits from workflow durability
 */
async function captureScreenshot(domain: string): Promise<CaptureResult> {
  "use step";

  const {
    captureScreenshotBase64,
    classifyScreenshotError,
    getScreenshotErrorCode,
    getScreenshotErrorContext,
  } = await import("@domainstack/screenshot");
  const { attempt } = getStepMetadata();

  try {
    const result = await captureScreenshotBase64(`https://${domain}`, {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      format: "webp",
      fullPage: false,
    });

    logger.info(
      {
        domain,
        attempt,
        sandboxId: result.sandboxId,
        durationMs: result.durationMs,
        width: result.width,
        height: result.height,
        errorCode: null,
        cleanupSucceeded: result.cleanupSucceeded,
      },
      "screenshot capture succeeded",
    );

    return {
      success: true,
      imageBuffer: result.imageBase64,
      width: result.width,
      height: result.height,
    };
  } catch (err) {
    const errorCode = getScreenshotErrorCode(err);
    const errorContext = getScreenshotErrorContext(err);
    const classification = classifyScreenshotError(err);
    logger.warn(
      { err, domain, attempt, errorCode, classification, ...errorContext },
      "screenshot capture failed",
    );

    if (classification === "permanent_target") {
      return { success: false, errorCode };
    }

    throw new RetryableError(`Screenshot capture failed: ${errorCode}`, { retryAfter: "5s" });
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

  const { storeImage } = await import("@domainstack/image");

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
async function persistSuccess(domain: string, url: string, pathname: string | null): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@domainstack/db/queries/domains");
  const { upsertScreenshot } = await import("@domainstack/db/queries/screenshots");
  const { ttlForScreenshot } = await import("@domainstack/server/ttl");

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

  const { ensureDomainRecord } = await import("@domainstack/db/queries/domains");
  const { upsertScreenshot } = await import("@domainstack/db/queries/screenshots");
  const { ttlForScreenshot } = await import("@domainstack/server/ttl");

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
}
