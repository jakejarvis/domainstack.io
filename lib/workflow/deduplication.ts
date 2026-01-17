import "server-only";

import { getRun, type Run } from "workflow/api";
import { createLogger } from "@/lib/logger/server";
import { getRedis } from "@/lib/redis";

const logger = createLogger({ source: "workflow/deduplication" });

/**
 * Redis key prefix for workflow run IDs.
 */
const WORKFLOW_KEY_PREFIX = "workflow:run";

/**
 * Default TTL for workflow run entries (5 minutes).
 * Should be longer than the longest expected workflow duration.
 */
const DEFAULT_TTL_SECONDS = 5 * 60;

/**
 * In-memory map of pending workflow runs, keyed by workflow+input hash.
 *
 * This provides request-level deduplication within a single server instance.
 * Multiple concurrent requests for the same workflow+input will share the
 * same workflow run instead of starting duplicate runs.
 */
const pendingRuns = new Map<string, Promise<unknown>>();

/**
 * In-memory map of pending workflow run IDs for fire-and-poll patterns.
 *
 * Used by getOrStartWorkflow to prevent concurrent same-instance requests
 * from both missing the Redis check and starting duplicate workflows.
 */
const pendingRunIds = new Map<string, string>();

/**
 * Options for workflow deduplication.
 */
export type DeduplicationOptions = {
  /**
   * TTL for the Redis entry in seconds.
   * Should be longer than the expected workflow duration.
   * @default 300 (5 minutes)
   */
  ttlSeconds?: number;
};

/**
 * Result from startWithDeduplication.
 */
export type DeduplicationResult<T> = {
  /** The workflow result */
  result: T;
  /** Whether this request attached to an existing run */
  deduplicated: boolean;
  /** Source of deduplication: 'memory' (same instance), 'redis' (cross-instance), or 'new' */
  source: "memory" | "redis" | "new";
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
 * Internal: Start workflow with in-memory-only deduplication.
 * Used as a building block for the main startWithDeduplication function.
 */
async function startWithMemoryDeduplication<T>(
  key: string,
  startWorkflow: () => Promise<T>,
  ttlMs: number,
): Promise<{ result: T; attached: boolean }> {
  // Extract workflow name from key for safe logging (avoid leaking input data)
  const workflow = key.split(":")[0] ?? "unknown";

  // Check if there's already a pending run for this key
  const pending = pendingRuns.get(key);
  if (pending) {
    logger.debug({ workflow }, "attaching to in-memory pending run");
    const result = (await pending) as T;
    return { result, attached: true };
  }

  // Start new workflow and store the promise
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

  const storedPromise = basePromise.finally(() => cleanup(storedPromise));
  pendingRuns.set(key, storedPromise);
  logger.debug({ workflow }, "started new workflow");

  // Safety valve timeout
  if (ttlMs > 0) {
    timeoutId = setTimeout(() => {
      if (pendingRuns.get(key) === storedPromise) {
        pendingRuns.delete(key);
        logger.warn(
          { workflow, ttlMs },
          "evicted pending workflow after timeout",
        );
      }
    }, ttlMs);
    // Best-effort: don't keep the process alive just because of this timer.
    // (Not available in all environments.)
    timeoutId.unref?.();
  }

  const result = await storedPromise;
  return { result, attached: false };
}

/**
 * Start a workflow with deduplication across server instances.
 *
 * Uses a two-tier approach:
 * 1. In-memory Map for same-instance deduplication (fast path)
 * 2. Redis for cross-instance deduplication (when available)
 *
 * When a duplicate request arrives:
 * - Same instance: Attaches to existing promise (via in-memory Map)
 * - Different instance: Gets runId from Redis, uses getRun() to await result
 *
 * Gracefully falls back to in-memory-only when Redis is unavailable.
 *
 * @param key - Deduplication key (use getDeduplicationKey)
 * @param startWorkflow - Function that starts the workflow and returns a Run object
 * @param options - Configuration options
 * @returns The workflow result with deduplication metadata
 *
 * @example
 * ```ts
 * const key = getDeduplicationKey("registration", domain);
 * const { result, deduplicated, source } = await startWithDeduplication(
 *   key,
 *   () => start(registrationWorkflow, [{ domain }]),
 * );
 * ```
 */
export async function startWithDeduplication<T>(
  key: string,
  startWorkflow: () => Promise<Run<T>>,
  options: DeduplicationOptions = {},
): Promise<DeduplicationResult<T>> {
  const { ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const ttlMs = ttlSeconds * 1000;
  const redisKey = `${WORKFLOW_KEY_PREFIX}:${key}`;
  const workflow = key.split(":")[0] ?? "unknown";

  // Fast path: Check in-memory Map first (same-instance deduplication)
  if (hasPendingRun(key)) {
    const { result } = await startWithMemoryDeduplication(
      key,
      async () => {
        const run = await startWorkflow();
        return run.returnValue;
      },
      ttlMs,
    );
    return { result, deduplicated: true, source: "memory" };
  }

  // Distributed path: Check Redis for existing run
  const redis = getRedis();

  if (redis) {
    try {
      const existingRunId = await redis.get<string>(redisKey);

      if (existingRunId) {
        logger.debug(
          { workflow, runId: existingRunId },
          "found existing run in Redis, subscribing",
        );

        try {
          const run = getRun<T>(existingRunId);
          const status = await run.status;

          if (status === "running" || status === "completed") {
            const result = await run.returnValue;
            return { result, deduplicated: true, source: "redis" };
          }

          // Run failed or unknown status - clear stale key before starting new
          // Without this, the nx:true set below would fail and break deduplication
          logger.debug(
            { workflow, runId: existingRunId, status },
            "existing run not usable, clearing stale key",
          );
          await redis.del(redisKey);
        } catch (err) {
          // Run not found or error - clear stale key before starting new
          logger.debug(
            { workflow, runId: existingRunId, err },
            "failed to get existing run, clearing stale key",
          );
          await redis.del(redisKey).catch(() => {});
        }
      }
    } catch (err) {
      logger.warn({ workflow, err }, "Redis error checking for existing run");
    }
  }

  // No existing run found - start new workflow
  const { result, attached } = await startWithMemoryDeduplication(
    key,
    async () => {
      const run = await startWorkflow();

      // Track whether we successfully stored the run ID (i.e., we own the key)
      let ownsRedisKey = false;

      // Store run ID in Redis for cross-instance deduplication
      if (redis) {
        try {
          // nx:true means set only if key doesn't exist - returns "OK" on success, null if key exists
          const setResult = await redis.set(redisKey, run.runId, {
            nx: true,
            ex: ttlSeconds,
          });
          ownsRedisKey = setResult === "OK";
          if (ownsRedisKey) {
            logger.debug(
              { workflow, runId: run.runId },
              "stored run ID in Redis",
            );
          } else {
            logger.debug(
              { workflow, runId: run.runId },
              "another instance already owns Redis key",
            );
          }
        } catch (err) {
          logger.warn({ workflow, err }, "failed to store run ID in Redis");
        }
      }

      const returnValue = await run.returnValue;

      // Clean up Redis entry on completion, but only if we own the key
      // Deleting unconditionally could remove another instance's active run ID
      if (redis && ownsRedisKey) {
        try {
          await redis.del(redisKey);
        } catch {
          // Non-fatal: entry will expire via TTL anyway
        }
      }

      return returnValue;
    },
    ttlMs,
  );

  // If we attached to an in-memory run, another call beat us after the Redis check
  if (attached) {
    return { result, deduplicated: true, source: "memory" };
  }

  return { result, deduplicated: false, source: "new" };
}

/**
 * Result from getOrStartWorkflow.
 */
export type GetOrStartResult = {
  /** The workflow run ID */
  runId: string;
  /** Whether a new workflow was started (false if attached to existing) */
  started: boolean;
};

/**
 * Get an existing workflow run or start a new one, returning the run ID immediately.
 *
 * This is useful for "fire and poll" patterns where the caller wants to return
 * the run ID immediately without waiting for the workflow to complete.
 *
 * Uses Redis to track running workflows across instances. Falls back to
 * always starting a new workflow if Redis is unavailable.
 *
 * @param key - Deduplication key (use getDeduplicationKey)
 * @param startWorkflow - Function that starts the workflow and returns a Run object
 * @param options - Configuration options
 * @returns The run ID and whether a new workflow was started
 *
 * @example
 * ```ts
 * const key = getDeduplicationKey("screenshot", domain);
 * const { runId, started } = await getOrStartWorkflow(
 *   key,
 *   () => start(screenshotWorkflow, [{ domain }]),
 * );
 * // Return runId to client for polling
 * ```
 */
export async function getOrStartWorkflow<T>(
  key: string,
  startWorkflow: () => Promise<Run<T>>,
  options: DeduplicationOptions = {},
): Promise<GetOrStartResult> {
  const { ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const redisKey = `${WORKFLOW_KEY_PREFIX}:${key}`;
  const workflow = key.split(":")[0] ?? "unknown";

  const redis = getRedis();

  // Check Redis for existing run
  if (redis) {
    try {
      const existingRunId = await redis.get<string>(redisKey);

      if (existingRunId) {
        // Verify the run is still active
        try {
          const run = getRun(existingRunId);
          const status = await run.status;

          if (status === "running") {
            logger.debug(
              { workflow, runId: existingRunId },
              "found existing running workflow in Redis",
            );
            return { runId: existingRunId, started: false };
          }

          // Run completed or failed - clear stale key before starting new
          // Without this, the nx:true set below would fail and break deduplication
          logger.debug(
            { workflow, runId: existingRunId, status },
            "existing run completed, clearing stale key",
          );
          await redis.del(redisKey);
        } catch {
          // Run not found - clear stale key before starting new
          logger.debug(
            { workflow, runId: existingRunId },
            "existing run not found, clearing stale key",
          );
          await redis.del(redisKey).catch(() => {});
        }
      }
    } catch (err) {
      logger.warn({ workflow, err }, "Redis error checking for existing run");
    }
  }

  // Check in-memory for same-instance concurrent requests
  // This prevents race conditions where multiple requests miss Redis and start duplicates
  const pendingRunId = pendingRunIds.get(key);
  if (pendingRunId) {
    logger.debug(
      { workflow, runId: pendingRunId },
      "found in-memory pending run, returning existing",
    );
    return { runId: pendingRunId, started: false };
  }

  // Start new workflow
  const run = await startWorkflow();

  // Store in memory for same-instance deduplication
  pendingRunIds.set(key, run.runId);

  // Clean up in-memory entry after TTL (Redis will be the source of truth after this)
  const cleanupTimeout = setTimeout(() => {
    if (pendingRunIds.get(key) === run.runId) {
      pendingRunIds.delete(key);
    }
  }, ttlSeconds * 1000);
  cleanupTimeout.unref?.();

  // Store run ID in Redis
  if (redis) {
    try {
      await redis.set(redisKey, run.runId, { nx: true, ex: ttlSeconds });
      logger.debug(
        { workflow, runId: run.runId },
        "stored new run ID in Redis",
      );
    } catch (err) {
      logger.warn({ workflow, err }, "failed to store run ID in Redis");
    }
  }

  return { runId: run.runId, started: true };
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
 */
export function clearAllPendingRuns(): void {
  pendingRuns.clear();
  pendingRunIds.clear();
}
