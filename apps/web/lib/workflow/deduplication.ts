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
 * Prefix for claim placeholders in Redis.
 * Used to claim the key before starting a workflow to prevent race conditions.
 */
const CLAIMING_PREFIX = "claiming:";

/**
 * TTL for claim placeholders (30 seconds).
 * Short enough to recover quickly if a claimer crashes, long enough for workflow startup.
 */
const CLAIM_TTL_SECONDS = 30;

/**
 * Maximum time to wait for a claim to resolve to a runId (ms).
 */
const CLAIM_WAIT_TIMEOUT_MS = 5000;

/**
 * Interval between polls when waiting for a claim to resolve (ms).
 */
const CLAIM_POLL_INTERVAL_MS = 100;

/**
 * Check if a Redis value is a claim placeholder vs a real runId.
 */
function isClaimPlaceholder(value: string): boolean {
  return value.startsWith(CLAIMING_PREFIX);
}

/**
 * Generate a unique claim placeholder.
 */
function generateClaimPlaceholder(): string {
  return `${CLAIMING_PREFIX}${crypto.randomUUID()}`;
}

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-memory map of pending workflow runs, keyed by workflow+input hash.
 *
 * This provides request-level deduplication within a single server instance.
 * Multiple concurrent requests for the same workflow+input will share the
 * same workflow run instead of starting duplicate runs.
 */
const pendingRuns = new Map<string, Promise<unknown>>();

/**
 * In-memory map of pending workflow start promises for fire-and-poll patterns.
 *
 * Used by getOrStartWorkflow to prevent concurrent same-instance requests
 * from both missing the Redis check and starting duplicate workflows.
 * Stores the promise itself (not the resolved value) so concurrent requests
 * can await the same start operation.
 */
const pendingStarts = new Map<string, Promise<Run<unknown>>>();

/**
 * In-memory map of resolved run IDs from pendingStarts.
 * Allows quick lookup after the start promise resolves without re-awaiting.
 */
const resolvedRunIds = new Map<string, string>();

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

  const redis = getRedis();

  // Helper to try attaching to an existing run by ID
  const tryAttachToRun = async (
    runId: string,
  ): Promise<DeduplicationResult<T> | null> => {
    try {
      const run = getRun<T>(runId);
      const status = await run.status;

      // Treat pending, running, and completed as active/usable runs
      if (
        status === "pending" ||
        status === "running" ||
        status === "completed"
      ) {
        const result = await run.returnValue;
        return { result, deduplicated: true, source: "redis" };
      }

      // Run failed or unknown status - not usable
      logger.debug({ workflow, runId, status }, "existing run not usable");
      return null;
    } catch (err) {
      logger.debug({ workflow, runId, err }, "failed to get existing run");
      return null;
    }
  };

  // Helper to wait for a claim to resolve to a runId
  const waitForRunId = async (): Promise<string | null> => {
    const deadline = Date.now() + CLAIM_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(CLAIM_POLL_INTERVAL_MS);
      try {
        const value = await redis?.get<string>(redisKey);
        if (!value) {
          // Key was deleted (claimer failed/aborted) - we can try to claim
          return null;
        }
        if (!isClaimPlaceholder(value)) {
          // It's a real runId now
          return value;
        }
        // Still a claim placeholder, keep waiting
      } catch (err) {
        // Redis error during poll - log but keep trying
        logger.debug({ workflow, err }, "Redis error during claim poll");
      }
    }
    // Timed out waiting for claim to resolve
    logger.debug({ workflow }, "timed out waiting for claim to resolve");
    return null;
  };

  // Distributed deduplication via Redis
  if (redis) {
    try {
      // Check if there's already a value (runId or claim)
      const existingValue = await redis.get<string>(redisKey);

      if (existingValue) {
        if (isClaimPlaceholder(existingValue)) {
          // Another instance is claiming - wait for them to set the runId
          logger.debug({ workflow }, "found claim placeholder, waiting");
          const runId = await waitForRunId();
          if (runId) {
            const attached = await tryAttachToRun(runId);
            if (attached) return attached;
          }
          // Claim timed out or run not usable - fall through to try claiming
        } else {
          // It's a runId - try to attach
          logger.debug(
            { workflow, runId: existingValue },
            "found existing run in Redis",
          );
          const attached = await tryAttachToRun(existingValue);
          if (attached) return attached;
          // Run not usable - clear stale key and try to claim
          await redis.del(redisKey).catch((err) => {
            logger.debug({ workflow, err }, "failed to delete stale key");
          });
        }
      }

      // Try to claim the key before starting the workflow
      const claimPlaceholder = generateClaimPlaceholder();
      const claimResult = await redis.set(redisKey, claimPlaceholder, {
        nx: true,
        ex: CLAIM_TTL_SECONDS,
      });

      if (claimResult === "OK") {
        // We claimed the key - now start the workflow
        logger.debug({ workflow }, "claimed Redis key, starting workflow");

        const { result, attached } = await startWithMemoryDeduplication(
          key,
          async () => {
            const run = await startWorkflow();

            // Update the claim placeholder with the actual runId
            try {
              await redis.set(redisKey, run.runId, { ex: ttlSeconds });
              logger.debug(
                { workflow, runId: run.runId },
                "updated claim with run ID",
              );
            } catch (err) {
              logger.warn(
                { workflow, err },
                "failed to update claim with run ID",
              );
            }

            const returnValue = await run.returnValue;

            // Clean up Redis entry on completion
            try {
              await redis.del(redisKey);
            } catch (err) {
              // Non-fatal: entry will expire via TTL anyway
              logger.debug({ workflow, err }, "failed to clean up Redis key");
            }

            return returnValue;
          },
          ttlMs,
        );

        if (attached) {
          return { result, deduplicated: true, source: "memory" };
        }
        return { result, deduplicated: false, source: "new" };
      }

      // Claim failed - another instance beat us, wait for their runId
      logger.debug({ workflow }, "claim failed, waiting for other instance");
      const runId = await waitForRunId();
      if (runId) {
        const attached = await tryAttachToRun(runId);
        if (attached) return attached;
      }

      // If we still can't attach, fall through to memory-only deduplication
      logger.debug(
        { workflow },
        "could not attach after claim wait, using memory-only",
      );
    } catch (err) {
      logger.warn({ workflow, err }, "Redis error in deduplication");
    }
  }

  // Fallback: memory-only deduplication (Redis unavailable or failed)
  const { result, attached } = await startWithMemoryDeduplication(
    key,
    async () => {
      const run = await startWorkflow();
      return run.returnValue;
    },
    ttlMs,
  );

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
 * in-memory-only deduplication when Redis is unavailable.
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

  // Helper to check if a runId is active (pending or running)
  const isRunActive = async (runId: string): Promise<boolean> => {
    try {
      const run = getRun(runId);
      const status = await run.status;
      return status === "pending" || status === "running";
    } catch (err) {
      // Log error but treat as inactive - we'll try to start a new workflow
      // which will either succeed (if old one is truly gone) or deduplicate
      logger.debug({ workflow, runId, err }, "failed to check run status");
      return false;
    }
  };

  // Helper to wait for a claim to resolve to a runId
  const waitForRunId = async (): Promise<string | null> => {
    const deadline = Date.now() + CLAIM_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(CLAIM_POLL_INTERVAL_MS);
      try {
        const value = await redis?.get<string>(redisKey);
        if (!value) {
          // Key was deleted - we can try to claim
          return null;
        }
        if (!isClaimPlaceholder(value)) {
          // It's a real runId now
          return value;
        }
      } catch (err) {
        // Redis error during poll - log but keep trying
        logger.debug({ workflow, err }, "Redis error during claim poll");
      }
    }
    return null;
  };

  // Distributed deduplication via Redis
  if (redis) {
    try {
      const existingValue = await redis.get<string>(redisKey);

      if (existingValue) {
        if (isClaimPlaceholder(existingValue)) {
          // Another instance is claiming - wait for them to set the runId
          logger.debug({ workflow }, "found claim placeholder, waiting");
          const runId = await waitForRunId();
          if (runId && (await isRunActive(runId))) {
            logger.debug(
              { workflow, runId },
              "attached to run after claim wait",
            );
            return { runId, started: false };
          }
          // Claim timed out or run not active - fall through to try claiming
        } else {
          // It's a runId - check if still active
          if (await isRunActive(existingValue)) {
            logger.debug(
              { workflow, runId: existingValue },
              "found existing active workflow in Redis",
            );
            return { runId: existingValue, started: false };
          }
          // Run not active - clear stale key
          logger.debug(
            { workflow, runId: existingValue },
            "existing run not active, clearing stale key",
          );
          await redis.del(redisKey).catch((err) => {
            logger.debug({ workflow, err }, "failed to delete stale key");
          });
        }
      }

      // Try to claim the key before starting the workflow
      const claimPlaceholder = generateClaimPlaceholder();
      const claimResult = await redis.set(redisKey, claimPlaceholder, {
        nx: true,
        ex: CLAIM_TTL_SECONDS,
      });

      if (claimResult === "OK") {
        // We claimed the key - now start the workflow with in-memory deduplication
        logger.debug({ workflow }, "claimed Redis key, starting workflow");

        // Check in-memory first (same-instance concurrent requests)
        const resolvedRunId = resolvedRunIds.get(key);
        if (resolvedRunId) {
          // Another call on this instance already started - update claim with their runId
          await redis.set(redisKey, resolvedRunId, { ex: ttlSeconds });
          return { runId: resolvedRunId, started: false };
        }

        const pendingStart = pendingStarts.get(key);
        if (pendingStart) {
          const run = await pendingStart;
          await redis.set(redisKey, run.runId, { ex: ttlSeconds });
          return { runId: run.runId, started: false };
        }

        // Start new workflow
        const startPromise = Promise.resolve().then(startWorkflow);
        pendingStarts.set(key, startPromise as Promise<Run<unknown>>);

        let run: Run<T>;
        try {
          run = await startPromise;
        } catch (err) {
          pendingStarts.delete(key);
          // Release the claim on failure
          await redis.del(redisKey).catch((delErr) => {
            logger.debug({ workflow, err: delErr }, "failed to release claim");
          });
          throw err;
        }

        // Update claim with actual runId
        resolvedRunIds.set(key, run.runId);
        pendingStarts.delete(key);

        try {
          await redis.set(redisKey, run.runId, { ex: ttlSeconds });
          logger.debug(
            { workflow, runId: run.runId },
            "updated claim with run ID",
          );
        } catch (err) {
          logger.warn({ workflow, err }, "failed to update claim with run ID");
        }

        // Set up cleanup
        const cleanupEntry = () => {
          if (resolvedRunIds.get(key) === run.runId) {
            resolvedRunIds.delete(key);
          }
        };

        getRun(run.runId)
          .status.then((status) => {
            if (status === "completed" || status === "failed") {
              cleanupEntry();
            }
          })
          .catch((err) => {
            // Clean up on error - if we can't check status, the entry isn't useful
            logger.debug(
              { workflow, runId: run.runId, err },
              "failed to check run status for cleanup",
            );
            cleanupEntry();
          });

        const cleanupTimeout = setTimeout(cleanupEntry, ttlSeconds * 1000);
        cleanupTimeout.unref?.();

        return { runId: run.runId, started: true };
      }

      // Claim failed - another instance beat us, wait for their runId
      logger.debug({ workflow }, "claim failed, waiting for other instance");
      const runId = await waitForRunId();
      if (runId && (await isRunActive(runId))) {
        return { runId, started: false };
      }

      // Could not attach via Redis - fall through to memory-only
      logger.debug({ workflow }, "could not attach after claim wait");
    } catch (err) {
      logger.warn({ workflow, err }, "Redis error in deduplication");
    }
  }

  // Fallback: memory-only deduplication (Redis unavailable or failed)
  const resolvedRunId = resolvedRunIds.get(key);
  if (resolvedRunId) {
    return { runId: resolvedRunId, started: false };
  }

  const pendingStart = pendingStarts.get(key);
  if (pendingStart) {
    const run = await pendingStart;
    return { runId: run.runId, started: false };
  }

  // Start new workflow
  const startPromise = Promise.resolve().then(startWorkflow);
  pendingStarts.set(key, startPromise as Promise<Run<unknown>>);

  let run: Run<T>;
  try {
    run = await startPromise;
  } catch (err) {
    pendingStarts.delete(key);
    throw err;
  }

  resolvedRunIds.set(key, run.runId);
  pendingStarts.delete(key);

  const cleanupEntry = () => {
    if (resolvedRunIds.get(key) === run.runId) {
      resolvedRunIds.delete(key);
    }
  };

  getRun(run.runId)
    .status.then((status) => {
      if (status === "completed" || status === "failed") {
        cleanupEntry();
      }
    })
    .catch((err) => {
      // Clean up on error - if we can't check status, the entry isn't useful
      logger.debug(
        { workflow, runId: run.runId, err },
        "failed to check run status for cleanup",
      );
      cleanupEntry();
    });

  const cleanupTimeout = setTimeout(cleanupEntry, ttlSeconds * 1000);
  cleanupTimeout.unref?.();

  return { runId: run.runId, started: true };
}

/**
 * Clear all pending runs. FOR TESTING ONLY.
 */
export function clearAllPendingRuns(): void {
  pendingRuns.clear();
  pendingStarts.clear();
  resolvedRunIds.clear();
}
