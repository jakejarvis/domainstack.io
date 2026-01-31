import "server-only";

import { analytics } from "@domainstack/analytics/server";
import type { CacheResult } from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";
import type { Run } from "workflow/api";
import type { WorkflowResult } from "./types";

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
   * Workflow name for logging (e.g., "registration", "dns").
   */
  workflowName: string;

  /**
   * The domain being queried.
   */
  domain: string;

  /**
   * Function to check the cache, returning data with staleness metadata.
   */
  getCached: () => Promise<CacheResult<T>>;

  /**
   * Function to start the workflow.
   * Should call `start(workflow, [input])` and return the Run object.
   */
  startWorkflow: () => Promise<Run<WorkflowResult<T>>>;

  /**
   * Maximum age of data in milliseconds before it's considered too stale.
   * If data was fetched longer than this ago, wait for fresh data instead
   * of returning stale data.
   *
   * If not set, stale data is always returned with background revalidation.
   *
   * @example
   * maxAgeMs: 24 * 60 * 60 * 1000 // Don't return data older than 24 hours
   */
  maxAgeMs?: number;
}

/**
 * Stale-while-revalidate cache helper for workflows.
 *
 * This helper implements the SWR pattern:
 * - If data is fresh: return immediately
 * - If data is stale but within maxAgeMs: return stale + background refresh
 * - If data is stale and exceeds maxAgeMs: wait for fresh data
 * - If no data: run workflow and wait for result
 *
 * Background revalidation is fire-and-forget. Workflows are idempotent,
 * so duplicates are harmless and failures just mean data stays stale.
 *
 * @example
 * ```ts
 * const result = await withSwrCache({
 *   workflowName: "registration",
 *   domain: "example.com",
 *   getCached: () => getCachedRegistration("example.com"),
 *   startWorkflow: () => start(registrationWorkflow, [{ domain: "example.com" }]),
 *   maxAgeMs: 24 * 60 * 60 * 1000, // Don't return data older than 24 hours
 * });
 * ```
 */
export async function withSwrCache<T>(
  options: SwrOptions<T>,
): Promise<SwrResult<T>> {
  const { workflowName, domain, getCached, startWorkflow, maxAgeMs } = options;

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

  // Step 3: If we have stale data, check if it's TOO stale
  if (cached.data && cached.stale) {
    // Check if data exceeds max age threshold
    const isTooOld =
      maxAgeMs !== undefined &&
      cached.fetchedAt !== null &&
      Date.now() - cached.fetchedAt.getTime() > maxAgeMs;

    if (isTooOld) {
      // Data is too old - treat as cache miss and wait for fresh data
      logger.debug(
        { domain, workflow: workflowName, maxAgeMs },
        "stale data exceeds max age, waiting for fresh data",
      );
      // Fall through to cache miss handling below
    } else {
      // Stale but acceptable - trigger background revalidation and return it
      logger.debug(
        { domain, workflow: workflowName },
        "returning stale data, triggering background revalidation",
      );

      // Fire and forget - workflows are idempotent
      startWorkflow()
        .then(() => {
          logger.debug(
            { domain, workflow: workflowName },
            "background revalidation started",
          );
        })
        .catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error(
            {
              workflow: workflowName,
              domain,
              trigger: "background_revalidation",
            },
            `workflow failed: ${errorMessage}`,
          );
          analytics.track(
            "workflow_failed",
            {
              workflow: workflowName,
              domain,
              classification: "retries_exhausted",
              error: errorMessage,
              trigger: "background_revalidation",
            },
            "system",
          );
        });

      return {
        success: true,
        cached: true,
        stale: true,
        data: cached.data,
      };
    }
  }

  // Step 4: No cached data - run workflow and wait for result
  logger.debug(
    { domain, workflow: workflowName },
    "cache miss, running workflow",
  );

  const run = await startWorkflow();
  const result = await run.returnValue;

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
