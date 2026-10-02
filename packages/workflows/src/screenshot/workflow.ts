import { createHook, FatalError, getStepMetadata, RetryableError } from "workflow";

import type { ScreenshotData } from "@domainstack/types";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 630;
// Every attempt is a paid sandbox.
const CAPTURE_MAX_RETRIES = 2;

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
      error: "capture_error";
      data: { url: null };
    };

type CaptureResult =
  | { success: true; imageBytes: Uint8Array }
  // `cache` says whether the miss is a property of the domain (cache it for the TTL)
  // or of this deployment (skip quietly, leave the cache alone).
  | { success: false; cache: boolean };

/**
 * Durable screenshot workflow that breaks down screenshot generation into
 * independently retryable steps:
 * 1. Check blocklist
 * 2. Capture screenshot (a single-use Vercel Sandbox)
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

  // Step 1: Check if domain is blocked
  const isBlocked = await checkBlocklist(domain);

  if (isBlocked) {
    return {
      success: true,
      data: { url: null, blocked: true },
    };
  }

  // Step 2: Capture screenshot in a single-use Vercel Sandbox
  // This is the heavy operation that benefits most from durability
  const captureResult = await captureScreenshot(domain);

  if (!captureResult.success) {
    // A deployment without a runner image says nothing about the domain, so
    // only a real capture failure is cached.
    if (captureResult.cache) {
      // Step 3a: Persist failure to cache
      await persistFailure(domain);
    }
    return {
      success: false,
      error: "capture_error",
      data: { url: null },
    };
  }

  // Step 3b: Process and store image to Vercel Blob
  const storageResult = await storeScreenshot(domain, captureResult.imageBytes);

  // Step 4: Persist to database
  await persistSuccess(domain, storageResult.url, storageResult.pathname);

  return {
    success: true,
    data: { url: storageResult.url, blocked: false },
  };
}

/**
 * Step: Check if a domain is on the blocklist
 */
async function checkBlocklist(domain: string): Promise<boolean> {
  "use step";

  const { isDomainBlocked } = await import("@domainstack/db/queries/blocked-domains");

  const blocked = await isDomainBlocked(domain);
  return blocked;
}

/**
 * Step: Capture screenshot in a single-use Vercel Sandbox
 * This is the heavy operation that benefits from workflow durability
 *
 * A failure is acted on by its class (see `classifyScreenshotError`):
 * - permanent_target: the site itself can't be captured (dead host, bad
 *   certificate, timeout). Return a cached miss instead of paying for a
 *   sandbox against it on every request.
 * - transient_target: possibly a hiccup on the site. Retry, and cache the miss
 *   on the final attempt so a persistently broken site stops costing sandboxes.
 * - infrastructure: our side broke (sandbox control plane, runner crash).
 *   Retry and never cache: a miss would blank the domain for the whole TTL.
 * - configuration: the deployment is broken (bad or missing-from-project
 *   image). Retrying can't help and the domain isn't at fault, so fail fatally
 *   without caching.
 * - not_configured: no runner image is set (normal in local development).
 *   Return a miss without caching and without throwing.
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
        cleanupSucceeded: result.cleanupSucceeded,
      },
      "screenshot capture succeeded",
    );

    return {
      success: true,
      imageBytes: Uint8Array.from(result.buffer),
    };
  } catch (err) {
    const errorCode = getScreenshotErrorCode(err);
    const classification = classifyScreenshotError(err);
    logger.warn(
      { err, domain, attempt, errorCode, classification, ...getScreenshotErrorContext(err) },
      "screenshot capture failed",
    );

    switch (classification) {
      case "permanent_target":
        return { success: false, cache: true };
      case "not_configured":
        return { success: false, cache: false };
      case "configuration":
        throw new FatalError(`Screenshot capture is misconfigured: ${errorCode}`);
      case "transient_target":
        if (attempt > CAPTURE_MAX_RETRIES) return { success: false, cache: true };
        throw new RetryableError(`Screenshot capture failed: ${errorCode}`, { retryAfter: "5s" });
      case "infrastructure":
        throw new RetryableError(`Screenshot capture failed: ${errorCode}`, { retryAfter: "5s" });
    }
  }
}
captureScreenshot.maxRetries = CAPTURE_MAX_RETRIES;

/**
 * Step: Store screenshot to Vercel Blob
 */
async function storeScreenshot(
  domain: string,
  imageBytes: Uint8Array,
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
  const { ttlForScreenshot } = await import("@domainstack/core/lib/ttl");

  try {
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
