import "server-only";

import { getRun, type Run } from "workflow/api";
import { createLogger } from "@/lib/logger/server";
import { getRedis } from "@/lib/redis";

const logger = createLogger({ source: "workflow/deduplication" });

// =============================================================================
// Constants
// =============================================================================

/** Redis key prefix for workflow run IDs. */
const WORKFLOW_KEY_PREFIX = "workflow:run:";

/**
 * Default TTL for workflow run entries (5 minutes).
 * Should be longer than the longest expected workflow duration.
 */
const DEFAULT_TTL_SECONDS = 5 * 60;

/**
 * Prefix for claim placeholders in Redis.
 * Used to claim the key before starting a workflow to prevent race conditions.
 */
const CLAIMING_PREFIX = "workflow:claiming:";

/**
 * TTL for claim placeholders (30 seconds).
 * Short enough to recover quickly if a claimer crashes, long enough for workflow startup.
 */
const CLAIM_TTL_SECONDS = 30;

/** Maximum time to wait for a claim to resolve to a runId (ms). */
const CLAIM_WAIT_TIMEOUT_MS = 5000;

/** Interval between polls when waiting for a claim to resolve (ms). */
const CLAIM_POLL_INTERVAL_MS = 100;

// =============================================================================
// Basic Helpers
// =============================================================================

function isClaimPlaceholder(value: string): boolean {
  return value.startsWith(CLAIMING_PREFIX);
}

function generateClaimPlaceholder(): string {
  return `${CLAIMING_PREFIX}${crypto.randomUUID()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  if (value === undefined) {
    return "null";
  }

  if (typeof value === "bigint") {
    return `{"$bigint":${JSON.stringify(value.toString())}}`;
  }

  if (value === null || typeof value !== "object") {
    const json = JSON.stringify(value);
    return json ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (value instanceof URL) {
    return JSON.stringify(value.toString());
  }

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
  if (typeof input === "string") {
    return `${workflowName}:${JSON.stringify(input)}`;
  }
  return `${workflowName}:${stableStringify(input)}`;
}

// =============================================================================
// In-Memory Deduplication Maps
// =============================================================================

/**
 * Pending workflow promises for same-instance deduplication.
 * Used by runDeduplicated to share results across concurrent requests.
 */
const pendingRuns = new Map<string, Promise<unknown>>();

/**
 * Pending workflow start promises for fire-and-poll patterns.
 * Used by startDeduplicated to prevent duplicate starts on same instance.
 */
const pendingStarts = new Map<string, Promise<Run<unknown>>>();

/**
 * Resolved run IDs from pendingStarts for quick lookup.
 */
const resolvedRunIds = new Map<string, string>();

// =============================================================================
// Shared Redis Helpers
// =============================================================================

type Redis = NonNullable<ReturnType<typeof getRedis>>;

/**
 * Wait for a claim placeholder to resolve to a real runId.
 * Returns the runId if found, or null if timed out or key was deleted.
 */
async function waitForClaimResolution(
  redis: Redis,
  redisKey: string,
  workflow: string,
): Promise<string | null> {
  const deadline = Date.now() + CLAIM_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(CLAIM_POLL_INTERVAL_MS);
    try {
      const value = await redis.get<string>(redisKey);
      if (!value) {
        // Key was deleted (claimer failed/aborted)
        return null;
      }
      if (!isClaimPlaceholder(value)) {
        // It's a real runId now
        return value;
      }
      // Still a claim placeholder, keep waiting
    } catch (err) {
      logger.debug({ workflow, err }, "Redis error during claim poll");
    }
  }

  logger.debug({ workflow }, "timed out waiting for claim to resolve");
  return null;
}

/**
 * Result from acquireOrAttach.
 */
type AcquireResult =
  | { type: "attached"; runId: string }
  | { type: "claimed"; release: () => Promise<void> }
  | { type: "fallback" };

/**
 * Try to acquire a Redis key for deduplication, or attach to an existing run.
 *
 * This handles the common Redis claim/attach pattern:
 * 1. Check for existing value (runId or claim placeholder)
 * 2. If claim placeholder, wait for it to resolve
 * 3. If runId, check if usable via the provided predicate
 * 4. If no usable run, try to claim the key
 * 5. If claim fails, wait for the winner's runId
 *
 * @param redis - Redis client
 * @param redisKey - The Redis key to use
 * @param workflow - Workflow name for logging
 * @param isRunUsable - Predicate to check if an existing run is usable
 * @returns AcquireResult indicating whether we attached, claimed, or should fallback
 */
async function acquireOrAttach(
  redis: Redis,
  redisKey: string,
  workflow: string,
  isRunUsable: (runId: string) => Promise<boolean>,
): Promise<AcquireResult> {
  // Check if there's already a value (runId or claim)
  const existingValue = await redis.get<string>(redisKey);

  if (existingValue) {
    if (isClaimPlaceholder(existingValue)) {
      // Another instance is claiming - wait for them to set the runId
      logger.debug({ workflow }, "found claim placeholder, waiting");
      const runId = await waitForClaimResolution(redis, redisKey, workflow);
      if (runId && (await isRunUsable(runId))) {
        return { type: "attached", runId };
      }
      // Claim timed out or run not usable - fall through to try claiming
    } else {
      // It's a runId - check if still usable
      logger.debug(
        { workflow, runId: existingValue },
        "found existing run in Redis",
      );
      if (await isRunUsable(existingValue)) {
        return { type: "attached", runId: existingValue };
      }
      // Run not usable - clear stale key
      logger.debug(
        { workflow, runId: existingValue },
        "existing run not usable, clearing stale key",
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
    logger.debug({ workflow }, "claimed Redis key");
    return {
      type: "claimed",
      release: async () => {
        await redis.del(redisKey).catch((err) => {
          logger.debug({ workflow, err }, "failed to release claim");
        });
      },
    };
  }

  // Claim failed - another instance beat us, wait for their runId
  logger.debug({ workflow }, "claim failed, waiting for other instance");
  const runId = await waitForClaimResolution(redis, redisKey, workflow);
  if (runId && (await isRunUsable(runId))) {
    return { type: "attached", runId };
  }

  // Could not attach - fall back to memory-only
  logger.debug({ workflow }, "could not attach after claim wait");
  return { type: "fallback" };
}

// =============================================================================
// In-Memory Deduplication Helper
// =============================================================================

/**
 * Start workflow with in-memory-only deduplication.
 * Used as a building block for the main functions.
 */
async function runWithMemoryDeduplication<T>(
  key: string,
  startWorkflow: () => Promise<T>,
  ttlMs: number,
): Promise<{ result: T; attached: boolean }> {
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

  // Clean up after completion (success or failure).
  // Guard against accidental overwrites (e.g. in tests or unusual callers).
  const cleanup = (storedPromise: Promise<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
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

// =============================================================================
// Public Types
// =============================================================================

export type DeduplicationOptions = {
  /**
   * TTL for the Redis entry in seconds.
   * @default 300 (5 minutes)
   */
  ttlSeconds?: number;
};

/**
 * Result from runDeduplicated.
 */
export type RunDeduplicatedResult<T> = {
  /** The workflow result */
  result: T;
  /** Whether this request attached to an existing run */
  deduplicated: boolean;
  /** Source of deduplication: 'memory' (same instance), 'redis' (cross-instance), or 'new' */
  source: "memory" | "redis" | "new";
};

/**
 * Result from startDeduplicated.
 */
export type StartDeduplicatedResult = {
  /** The workflow run ID */
  runId: string;
  /** Whether a new workflow was started (false if attached to existing) */
  started: boolean;
};

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Run a workflow with deduplication, waiting for the result.
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
 * Use this when you need the workflow result immediately.
 *
 * @param key - Deduplication key (use getDeduplicationKey)
 * @param startWorkflow - Function that starts the workflow and returns a Run object
 * @param options - Configuration options
 * @returns The workflow result with deduplication metadata
 *
 * @example
 * ```ts
 * const key = getDeduplicationKey("registration", domain);
 * const { result, deduplicated, source } = await runDeduplicated(
 *   key,
 *   () => start(registrationWorkflow, [{ domain }]),
 * );
 * ```
 */
export async function runDeduplicated<T>(
  key: string,
  startWorkflow: () => Promise<Run<T>>,
  options: DeduplicationOptions = {},
): Promise<RunDeduplicatedResult<T>> {
  const { ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const ttlMs = ttlSeconds * 1000;
  const redisKey = `${WORKFLOW_KEY_PREFIX}${key}`;
  const workflow = key.split(":")[0] ?? "unknown";

  const redis = getRedis();

  // Check if run is usable for awaiting result.
  // Treat pending, running, and completed as active/usable runs
  // (all can provide a returnValue).
  const isRunUsableForAwait = async (runId: string): Promise<boolean> => {
    try {
      const run = getRun<T>(runId);
      const status = await run.status;
      return (
        status === "pending" || status === "running" || status === "completed"
      );
    } catch (err) {
      // Run failed or unknown status - not usable
      logger.debug({ workflow, runId, err }, "failed to get existing run");
      return false;
    }
  };

  // Try Redis-based deduplication
  if (redis) {
    try {
      const acquired = await acquireOrAttach(
        redis,
        redisKey,
        workflow,
        isRunUsableForAwait,
      );

      if (acquired.type === "attached") {
        const run = getRun<T>(acquired.runId);
        const result = await run.returnValue;
        return { result, deduplicated: true, source: "redis" };
      }

      if (acquired.type === "claimed") {
        // We claimed the key - start the workflow
        const { result, attached } = await runWithMemoryDeduplication(
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

            // Clean up Redis entry on completion.
            // Non-fatal: entry will expire via TTL anyway.
            try {
              await redis.del(redisKey);
            } catch (err) {
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

      // acquired.type === "fallback" - continue to memory-only
    } catch (err) {
      logger.warn({ workflow, err }, "Redis error in deduplication");
    }
  }

  // Fallback: memory-only deduplication
  const { result, attached } = await runWithMemoryDeduplication(
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
 * Start a workflow with deduplication, returning the run ID immediately.
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
 * const { runId, started } = await startDeduplicated(
 *   key,
 *   () => start(screenshotWorkflow, [{ domain }]),
 * );
 * // Return runId to client for polling
 * ```
 */
export async function startDeduplicated<T>(
  key: string,
  startWorkflow: () => Promise<Run<T>>,
  options: DeduplicationOptions = {},
): Promise<StartDeduplicatedResult> {
  const { ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  const redisKey = `${WORKFLOW_KEY_PREFIX}${key}`;
  const workflow = key.split(":")[0] ?? "unknown";

  const redis = getRedis();

  // Check if run is usable for polling (must still be active).
  // Only pending or running runs are usable - completed runs need a fresh start
  // since the client needs an active run to poll.
  const isRunUsableForPolling = async (runId: string): Promise<boolean> => {
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

  // Helper to start workflow with in-memory deduplication
  const startWithMemoryDedup = async (): Promise<StartDeduplicatedResult> => {
    // Check resolved cache first
    const cachedRunId = resolvedRunIds.get(key);
    if (cachedRunId) {
      return { runId: cachedRunId, started: false };
    }

    // Check pending starts
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
  };

  // Try Redis-based deduplication
  if (redis) {
    try {
      const acquired = await acquireOrAttach(
        redis,
        redisKey,
        workflow,
        isRunUsableForPolling,
      );

      if (acquired.type === "attached") {
        return { runId: acquired.runId, started: false };
      }

      if (acquired.type === "claimed") {
        // We claimed the key - check memory first, then start
        const cachedRunId = resolvedRunIds.get(key);
        if (cachedRunId) {
          await redis.set(redisKey, cachedRunId, { ex: ttlSeconds });
          return { runId: cachedRunId, started: false };
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
          await acquired.release();
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

      // acquired.type === "fallback" - continue to memory-only
    } catch (err) {
      logger.warn({ workflow, err }, "Redis error in deduplication");
    }
  }

  // Fallback: memory-only deduplication
  return startWithMemoryDedup();
}

// =============================================================================
// Testing Utilities
// =============================================================================

/**
 * Clear all pending runs. FOR TESTING ONLY.
 */
export function clearAllPendingRuns(): void {
  pendingRuns.clear();
  pendingStarts.clear();
  resolvedRunIds.clear();
}
