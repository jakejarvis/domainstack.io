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
 * Check if a value is a plain object (not a class instance like Date, Map, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively sort object keys for stable JSON stringification.
 * Arrays preserve order; plain objects get sorted keys.
 * Non-plain objects (Date, Map, etc.) fall back to JSON.stringify.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  // For non-plain objects (Date, Map, custom classes, etc.),
  // use JSON.stringify which respects toJSON methods
  if (!isPlainObject(value)) {
    return JSON.stringify(value);
  }

  const sortedKeys = Object.keys(value).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`,
  );
  return `{${pairs.join(",")}}`;
}

/**
 * Generate a deduplication key for a workflow run.
 *
 * @param workflowName - The name/identifier of the workflow
 * @param input - The workflow input (will be stably stringified with sorted keys)
 * @returns A stable key for deduplication
 */
export function getDeduplicationKey(
  workflowName: string,
  input: unknown,
): string {
  return `${workflowName}:${stableStringify(input)}`;
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
    logger.info(`attaching to pending ${workflow} workflow`);
    return pending as Promise<T>;
  }

  // Start new workflow and store the promise
  const runPromise = startWorkflow().finally(() => {
    // Clean up after completion (success or failure)
    pendingRuns.delete(key);
  });

  pendingRuns.set(key, runPromise);
  logger.debug(`started new ${workflow} workflow`);

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
