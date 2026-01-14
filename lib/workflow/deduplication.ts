import "server-only";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "workflow/deduplication" });

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

export type DeduplicationOptions<T> = {
  /**
   * Keep the deduplication entry alive until this operation completes.
   *
   * This is useful when you want to return early (e.g. return a runId) but still
   * prevent duplicate workflow *starts* while the underlying workflow is running.
   */
  keepAliveUntil?: (result: T) => unknown | Promise<unknown>;

  /**
   * Safety valve: evict a pending entry after this many ms to avoid poisoning
   * a key forever if a promise hangs.
   *
   * Note: eviction may allow another workflow to start for the same key.
   */
  maxPendingMs?: number;
};

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
  // Match JSON.stringify behavior more closely, but always return a string.
  // (JSON.stringify(undefined) returns undefined which breaks our key format.)
  if (value === undefined) {
    return "null";
  }

  if (typeof value === "bigint") {
    // Avoid throwing (JSON.stringify(BigInt) throws), and avoid collisions with strings/numbers.
    return `{"$bigint":${JSON.stringify(value.toString())}}`;
  }

  if (value === null || typeof value !== "object") {
    const json = JSON.stringify(value);
    return json ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  // Common non-plain objects we intentionally support.
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (value instanceof URL) {
    return JSON.stringify(value.toString());
  }

  // For other non-plain objects (Map, Set, custom classes, etc.), fail fast:
  // JSON.stringify often collapses these to "{}", causing key collisions.
  if (!isPlainObject(value)) {
    throw new TypeError(
      `Unsupported value in workflow deduplication key: ${Object.prototype.toString.call(value)}`,
    );
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
  // Fast path for string inputs (most common case: domain names)
  // Avoids unnecessary processing through stableStringify
  if (typeof input === "string") {
    return `${workflowName}:${JSON.stringify(input)}`;
  }
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
  options: DeduplicationOptions<T> = {},
): Promise<T> {
  // Extract workflow name from key for safe logging (avoid leaking input data)
  const workflow = key.split(":")[0] ?? "unknown";

  // Check if there's already a pending run for this key
  const pending = pendingRuns.get(key);
  if (pending) {
    logger.debug(`attaching to pending ${workflow} workflow`);
    return pending as Promise<T>;
  }

  // Start new workflow and store the promise.
  //
  // Important: wrap in Promise.resolve().then(...) so that if `startWorkflow`
  // throws synchronously (despite its type), we still:
  // - have a promise to store in `pendingRuns` for other callers to attach to
  // - run cleanup via `.finally`
  const basePromise = Promise.resolve().then(startWorkflow);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const cleanup = (storedPromise: Promise<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Clean up after completion (success or failure).
    // Guard against accidental overwrites (e.g. in tests or unusual callers).
    if (pendingRuns.get(key) === storedPromise) {
      pendingRuns.delete(key);
    }
  };

  // If we aren't keeping the key alive, preserve the previous behavior:
  // - callers awaiting the returned promise will only resolve after cleanup is done
  // - this avoids subtle races in callers/tests that immediately start another run
  let storedPromise: Promise<T>;
  if (options.keepAliveUntil) {
    storedPromise = basePromise;
  } else {
    storedPromise = basePromise.finally(() => cleanup(storedPromise));
  }

  pendingRuns.set(key, storedPromise);
  logger.debug(`started new ${workflow} workflow`);

  if (options.maxPendingMs && options.maxPendingMs > 0) {
    timeoutId = setTimeout(() => {
      if (pendingRuns.get(key) === storedPromise) {
        pendingRuns.delete(key);
        logger.warn(
          { workflow, maxPendingMs: options.maxPendingMs },
          "evicted pending workflow deduplication entry after timeout",
        );
      }
    }, options.maxPendingMs);

    // Best-effort: don't keep the process alive just because of this timer.
    // (Not available in all environments.)
    timeoutId.unref?.();
  }

  if (options.keepAliveUntil) {
    // Cleanup lifecycle:
    // - Always clean up if start throws / rejects.
    // - Keep the entry alive until keepAliveUntil settles.
    void storedPromise
      .then(async (result) => {
        await options.keepAliveUntil?.(result);
      })
      .catch(() => {
        // Swallow: errors propagate via `storedPromise` to callers, but we still want cleanup.
      })
      .finally(() => cleanup(storedPromise));
  }

  return storedPromise;
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
