import { start } from "workflow/api";
import { createLogger } from "@/lib/logger/server";
import type { BlobUrlWithBlockedFlagResponse } from "@/lib/schemas";
import { screenshotWorkflow } from "@/workflows/screenshot/workflow";

const logger = createLogger({ source: "screenshot" });

// In-memory lock to prevent concurrent workflow starts for the same domain
const screenshotPromises = new Map<
  string,
  Promise<BlobUrlWithBlockedFlagResponse>
>();

// Safety timeout for cleaning up stale promises (120 seconds - workflows can take longer)
const PROMISE_CLEANUP_TIMEOUT_MS = 120_000;

/**
 * Get or generate a screenshot for a domain.
 *
 * This is a thin wrapper around the durable screenshot workflow.
 * The workflow handles:
 * - Blocklist checking
 * - Cache checking (Postgres)
 * - Screenshot capture (Puppeteer with retries)
 * - Image processing and storage (Vercel Blob)
 * - Database persistence
 *
 * @deprecated Use screenshotWorkflow directly via tRPC workflow procedures
 */
export async function getScreenshot(
  domain: string,
): Promise<BlobUrlWithBlockedFlagResponse> {
  // Check for in-flight request (prevents concurrent workflow starts)
  if (screenshotPromises.has(domain)) {
    logger.debug({ domain }, "returning in-flight screenshot promise");
    // biome-ignore lint/style/noNonNullAssertion: checked above
    return screenshotPromises.get(domain)!;
  }

  // Create a new promise with guaranteed cleanup
  const promise = (async () => {
    try {
      return await executeScreenshotWorkflow(domain);
    } finally {
      screenshotPromises.delete(domain);
    }
  })();

  // Store promise with safety timeout cleanup
  screenshotPromises.set(domain, promise);

  // Safety: Auto-cleanup stale promise after timeout
  const timeoutId = setTimeout(() => {
    if (screenshotPromises.get(domain) === promise) {
      logger.warn({ domain }, "cleaning up stale screenshot promise");
      screenshotPromises.delete(domain);
    }
  }, PROMISE_CLEANUP_TIMEOUT_MS);

  // Clear timeout when promise settles
  void promise.finally(() => clearTimeout(timeoutId));

  // Log map size for monitoring
  if (screenshotPromises.size > 10) {
    logger.warn(
      { size: screenshotPromises.size },
      "screenshot promise map size high",
    );
  }

  return promise;
}

/**
 * Execute the screenshot workflow and wait for the result.
 */
async function executeScreenshotWorkflow(
  domain: string,
): Promise<BlobUrlWithBlockedFlagResponse> {
  try {
    // Start the durable workflow
    const run = await start(screenshotWorkflow, [{ domain }]);

    logger.debug({ domain, runId: run.runId }, "screenshot workflow started");

    // Wait for the workflow to complete and get the result
    const result = await run.returnValue;

    logger.debug(
      {
        domain,
        runId: run.runId,
        cached: result.cached,
        blocked: result.blocked,
      },
      "screenshot workflow completed",
    );

    return {
      url: result.url,
      // Only include blocked: true when actually blocked (schema is z.literal(true).optional())
      ...(result.blocked && { blocked: true as const }),
    };
  } catch (err) {
    logger.error({ err, domain }, "screenshot workflow failed");

    // Return null URL on failure (maintains backward compatibility)
    return { url: null };
  }
}
