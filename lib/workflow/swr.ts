import "server-only";

import { analytics } from "@/lib/analytics/server";
import type { CacheResult } from "@/lib/db/repos/types";
import { createLogger } from "@/lib/logger/server";
import { getDeduplicationKey, startWithDeduplication } from "./deduplication";
import type { WorkflowResult } from "./types";

/** Safety valve timeout for background revalidation (5 minutes) */
const BACKGROUND_REVALIDATION_TIMEOUT_MS = 5 * 60 * 1000;

const logger = createLogger({ source: "workflow/swr" });

/**
 * Result type for stale-while-revalidate operations.
 * Discriminated union for type safety:
 * - success: true → includes cached, stale, data
 * - success: false → includes error, data: null
 */
export type SwrResult<T> =
  | {
      success: true;
      /** True if data came from cache (fresh or stale) */
      cached: boolean;
      /** True if data is expired but returned anyway (background revalidation triggered) */
      stale: boolean;
      /** The data */
      data: T;
    }
  | {
      success: false;
      /** Error message */
      error: string;
      /** Data is null on failure */
      data: null;
    };

/**
 * Options for the withSwrCache helper.
 */
export interface SwrOptions<T> {
  /**
   * Workflow name for deduplication (e.g., "registration", "dns").
   */
  workflowName: string;

  /**
   * The domain being queried (used for deduplication key).
   */
  domain: string;

  /**
   * Function to check the cache, returning data with staleness metadata.
   */
  getCached: () => Promise<CacheResult<T>>;

  /**
   * Function to start the workflow.
   * Should call `start(workflow, [input])` and return the Run object.
   * The helper will decide whether to await returnValue or not.
   */
  startWorkflow: () => Promise<{ returnValue: Promise<WorkflowResult<T>> }>;
}

/**
 * Stale-while-revalidate cache helper for workflows.
 *
 * This helper implements the SWR pattern:
 * - If data is fresh: return immediately
 * - If data is stale: trigger background revalidation and return stale data
 * - If no data: run workflow and wait for result
 *
 * @example
 * ```ts
 * const result = await withSwrCache({
 *   workflowName: "registration",
 *   domain: "example.com",
 *   getCached: () => getRegistration("example.com"),
 *   startWorkflow: () => start(registrationWorkflow, [{ domain: "example.com" }]),
 * });
 * ```
 */
export async function withSwrCache<T>(
  options: SwrOptions<T>,
): Promise<SwrResult<T>> {
  const { workflowName, domain, getCached, startWorkflow } = options;

  // Step 1: Check cache (returns data even if stale)
  const cached = await getCached();

  // Step 2: If we have fresh data, return immediately
  if (cached.data && !cached.stale) {
    return {
      success: true,
      cached: true,
      stale: false,
      data: cached.data,
    };
  }

  // Step 3: If we have stale data, trigger background revalidation and return it
  if (cached.data && cached.stale) {
    logger.debug(
      { domain, workflow: workflowName },
      "returning stale data, triggering background revalidation",
    );

    // Start workflow in background (fire and forget)
    // Use deduplication to avoid duplicate background runs
    const key = getDeduplicationKey(workflowName, domain);

    // Fire-and-forget: start the workflow but don't await returnValue
    // Use maxPendingMs as safety valve to prevent hung workflows from blocking future revalidation
    void startWithDeduplication(
      key,
      async () => {
        const run = await startWorkflow();
        // Await returnValue here so the deduplication entry stays alive
        // until the workflow completes (prevents duplicate starts)
        return run.returnValue;
      },
      { maxPendingMs: BACKGROUND_REVALIDATION_TIMEOUT_MS },
    ).catch((err) => {
      // Log and track - this is background work but failures may indicate systemic issues
      logger.error(
        { err, domain, workflow: workflowName },
        "background revalidation failed",
      );
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        {
          source: "workflow/swr",
          domain,
          workflow: workflowName,
        },
      );
    });

    return {
      success: true,
      cached: true,
      stale: true,
      data: cached.data,
    };
  }

  // Step 4: No cached data - run workflow and wait for result
  logger.debug(
    { domain, workflow: workflowName },
    "cache miss, running workflow",
  );

  const key = getDeduplicationKey(workflowName, domain);
  const result = await startWithDeduplication(key, async () => {
    const run = await startWorkflow();
    return run.returnValue;
  });

  if (result.success) {
    return {
      success: true,
      cached: false,
      stale: false,
      data: result.data,
    };
  }

  return {
    success: false,
    error: result.error ?? "Workflow failed",
    data: null,
  };
}
