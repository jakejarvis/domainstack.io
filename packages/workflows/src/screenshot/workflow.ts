import { createHook, RetryableError } from "workflow";

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
      error: "capture_error";
      data: { url: null };
    };

type CaptureResult = { success: true; imageBytes: Uint8Array } | { success: false };

/**
 * Puppeteer/browser-crash errors, as opposed to a navigation failure caused
 * by the target site itself (DNS, connection refused, TLS, timeout — all
 * surfaced by Chromium as `net::ERR_*` or a navigation `TimeoutError`).
 * These mean the browser process itself broke mid-capture, unrelated to the
 * domain being captured, and must not be cached as "this domain can't be
 * captured."
 */
const INFRA_CAPTURE_ERROR_PATTERN =
  /protocol error|target (closed|crashed)|session closed|page, context or browser (has )?been closed|websocket is (not open|closed)|connection closed|socket hang up|browser (has )?disconnected/i;

/** @internal exported for testing only */
export function isInfraCaptureError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return INFRA_CAPTURE_ERROR_PATTERN.test(message);
}

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
  const storageResult = await storeScreenshot(domain, captureResult.imageBytes);

  // Step 4: Persist to database
  await persistSuccess(domain, storageResult.url, storageResult.pathname);

  return {
    success: true,
    data: { url: storageResult.url, blocked: false },
  };
}

/**
 * Step: Capture screenshot using Puppeteer
 * This is the heavy operation that benefits from workflow durability
 *
 * Three failure classes are handled differently:
 * - Browser launch failures are an infrastructure problem, not a property of
 *   the domain, so they retry. Caching them would blank out every domain
 *   captured during the outage for a full screenshot TTL.
 * - A crashed browser/page mid-capture (protocol error, target/session
 *   closed) is also infrastructure, not evidence the domain is
 *   uncapturable, so it retries too.
 * - Navigation, timeout, and TLS failures mean this site cannot be captured.
 *   They are returned so the caller can cache the miss instead of re-running
 *   Puppeteer against a dead host on every request.
 */
async function captureScreenshot(domain: string): Promise<CaptureResult> {
  "use step";

  const { captureScreenshot: capture, getBrowser } = await import("@domainstack/screenshot");
  const { createLogger } = await import("@domainstack/logger");
  const logger = createLogger({ source: "screenshot/workflow" });

  try {
    await getBrowser();
  } catch (err) {
    throw new RetryableError(
      `Browser launch failed: ${err instanceof Error ? err.message : String(err)}`,
      { retryAfter: "10s" },
    );
  }

  try {
    const result = await capture(`https://${domain}`, {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      format: "webp",
      fullPage: false,
    });

    return {
      success: true,
      imageBytes: Uint8Array.from(result.buffer),
    };
  } catch (err) {
    if (isInfraCaptureError(err)) {
      throw new RetryableError(
        `Screenshot capture infra failure: ${err instanceof Error ? err.message : String(err)}`,
        { retryAfter: "10s" },
      );
    }
    logger.debug({ err, domain }, "screenshot unavailable, caching miss");
    return { success: false };
  }
}

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
