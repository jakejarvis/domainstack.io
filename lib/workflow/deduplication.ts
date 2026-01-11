import "server-only";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "workflow-deduplication" });

/**
 * In-memory map of pending workflow runs, keyed by workflow+input hash.
 *
 * This provides request-level deduplication within a single server instance.
 * Multiple concurrent requests for the same workflow+input will share the
 * same workflow run instead of starting duplicate runs.
 *
 * Note: This is per-instance deduplication only. In a multi-instance
 * deployment, some duplicate runs may still occur (which is fine - the
 * database operations are idempotent via upserts).
 */
const pendingRuns = new Map<string, Promise<unknown>>();

/**
 * Generate a deduplication key for a workflow run.
 *
 * @param workflowName - The name/identifier of the workflow
 * @param input - The workflow input (will be JSON stringified)
 * @returns A stable key for deduplication
 */
export function getDeduplicationKey(
  workflowName: string,
  input: unknown,
): string {
  return `${workflowName}:${JSON.stringify(input)}`;
}

/**
 * Start a workflow with request-level deduplication.
 *
 * If a workflow with the same name and input is already in progress,
 * returns the existing run's result instead of starting a new one.
 *
 * @param key - The deduplication key (use getDeduplicationKey)
 * @param startWorkflow - Function that starts the workflow and returns run.returnValue
 * @returns The workflow result
 *
 * @example
 * ```ts
 * const key = getDeduplicationKey("registration", { domain });
 * const result = await startWithDeduplication(key, async () => {
 *   const run = await start(registrationWorkflow, [{ domain }]);
 *   return run.returnValue;
 * });
 * ```
 */
export async function startWithDeduplication<T>(
  key: string,
  startWorkflow: () => Promise<T>,
): Promise<T> {
  // Extract workflow name from key for safe logging (avoid leaking input data)
  const workflow = key.split(":")[0] ?? "unknown";

  // Check if there's already a pending run for this key
  const pending = pendingRuns.get(key);
  if (pending) {
    logger.debug({ workflow }, "reusing pending workflow run");
    return pending as Promise<T>;
  }

  // Start new workflow and store the promise
  const runPromise = startWorkflow().finally(() => {
    // Clean up after completion (success or failure)
    pendingRuns.delete(key);
  });

  pendingRuns.set(key, runPromise);
  logger.debug({ workflow }, "started new workflow run");

  return runPromise;
}

/**
 * Check if a workflow run is currently pending for the given key.
 */
export function hasPendingRun(key: string): boolean {
  return pendingRuns.has(key);
}

/**
 * Get the current count of pending runs (for monitoring/debugging).
 */
export function getPendingRunCount(): number {
  return pendingRuns.size;
}

/**
 * Clear all pending runs. FOR TESTING ONLY.
 *
 * This is exposed to allow tests to reset state between runs without
 * relying on arbitrary timeouts.
 */
export function clearAllPendingRuns(): void {
  pendingRuns.clear();
}
