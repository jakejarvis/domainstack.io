import "server-only";

import type { Run } from "workflow/api";
import { analytics } from "@/lib/analytics/server";
import type { CacheResult } from "@/lib/db/repos/types";
import { createLogger } from "@/lib/logger/server";
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
}

/**
 * Stale-while-revalidate cache helper for workflows.
 *
 * This helper implements the SWR pattern:
 * - If data is fresh: return immediately
 * - If data is stale: trigger background revalidation and return stale data
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
