import { createHook, getStepMetadata, RetryableError } from "workflow";

import type { ScreenshotData } from "@domainstack/types";

import { checkBlocklist } from "../steps/blocklist";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;

export function getScreenshotWorkflowToken(domainId: string): string {
  return `screenshot:${domainId}`;
}

interface ScreenshotWorkflowInput {
  domain: string;
  domainId: string;
}

export type ScreenshotWorkflowResult =
  | {
      success: true;
      data: ScreenshotData;
    }
  | {
      success: false;
      error: "capture_error" | "configuration_error";
      /** Specific capture failure, e.g. `dns_error` or `target_blocked`. */
      errorCode?: string;
      data: { url: null };
    };

type CaptureResult =
  | { success: true; imageBytes: Uint8Array; width: number; height: number }
  | {
      success: false;
      errorCode: string;
      /** A broken deployment must not be cached as a missing screenshot. */
      configurationError: boolean;
    };

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

  const { domain, domainId } = input;

  using ownership = createHook({
    token: getScreenshotWorkflowToken(domainId),
  });
  const conflictingRun = await ownership.getConflict();
  if (conflictingRun) {
    return (await conflictingRun.returnValue) as ScreenshotWorkflowResult;
  }

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
    // A misconfigured deployment says nothing about the domain, so it must not
    // be cached as a missing screenshot.
    if (captureResult.configurationError) {
      return {
        success: false,
        error: "configuration_error",
        errorCode: captureResult.errorCode,
        data: { url: null },
      };
    }

    // Step 3a: Persist failure to cache
    await persistFailure(domain);
    return {
      success: false,
      error: "capture_error",
      errorCode: captureResult.errorCode,
      data: { url: null },
    };
  }

  // Step 3b: Process and store image to Vercel Blob
  const storageResult = await storeScreenshot(
    domain,
    captureResult.imageBytes,
    captureResult.width,
    captureResult.height,
  );

  // Step 4: Persist to database
  await persistSuccess(
    domain,
    storageResult.url,
    storageResult.pathname,
    captureResult.width,
    captureResult.height,
  );

  return {
    success: true,
    data: { url: storageResult.url, blocked: false },
  };
}

/**
 * Step: Capture screenshot using Vercel Sandbox
 *
 * Failures are separated by what they say about the target:
 * - A bad target (DNS, TLS, blocked) is returned so the caller can cache the
 *   miss instead of re-running a Sandbox against a dead host on every request.
 * - A misconfigured deployment is returned too, but flagged, so it stops
 *   without blaming the domain.
 * - Everything else is infrastructure and retries. Caching those would blank
 *   out every domain captured during an outage for a full screenshot TTL.
 */
async function captureScreenshot(domain: string): Promise<CaptureResult> {
  "use step";

  const {
    captureScreenshot: capture,
    classifyScreenshotError,
    getScreenshotErrorCode,
    getScreenshotErrorContext,
  } = await import("@domainstack/screenshot");
  const { createLogger } = await import("@domainstack/logger");
  const logger = createLogger({ source: "screenshot/workflow" });
  const { attempt } = getStepMetadata();

  try {
    const result = await capture(`https://${domain}`, {
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
      imageBytes: Uint8Array.from(result.buffer),
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

    if (classification === "permanent_target" || classification === "permanent_configuration") {
      return {
        success: false,
        errorCode,
        configurationError: classification === "permanent_configuration",
      };
    }

    throw new RetryableError(`Screenshot capture failed: ${errorCode}`, { retryAfter: "5s" });
  }
}

/**
 * Step: Store screenshot to Vercel Blob
 */
async function storeScreenshot(
  domain: string,
  imageBytes: Uint8Array,
  width: number,
  height: number,
): Promise<{
  url: string;
  pathname: string | null;
}> {
  "use step";

  const { storeImage } = await import("@domainstack/image");

  // Store to Vercel Blob
  const { url, pathname } = await storeImage({
    kind: "screenshot",
    domain,
    buffer: Buffer.from(imageBytes),
    width,
    height,
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
  width: number,
  height: number,
): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@domainstack/db/queries/domains");
  const { upsertScreenshot } = await import("@domainstack/db/queries/screenshots");
  const { ttlForScreenshot } = await import("@domainstack/core/lib/ttl");

  try {
    const domainRecord = await ensureDomainRecord(domain);
    const now = new Date();
    const expiresAt = ttlForScreenshot(now);

    await upsertScreenshot({
      domainId: domainRecord.id,
      url,
      pathname,
      width,
      height,
      notFound: false,
      fetchedAt: now,
      expiresAt,
    });
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `persisting screenshot for ${domain}` });
  }
}

/**
 * Step: Persist failure to database cache
 */
async function persistFailure(domain: string): Promise<void> {
  "use step";

  const { ensureDomainRecord } = await import("@domainstack/db/queries/domains");
  const { upsertScreenshot } = await import("@domainstack/db/queries/screenshots");
  const { ttlForScreenshot } = await import("@domainstack/core/lib/ttl");

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
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, {
      context: `persisting screenshot failure for ${domain}`,
    });
  }
}
