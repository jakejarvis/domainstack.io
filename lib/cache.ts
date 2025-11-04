import { ns, redis } from "@/lib/redis";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LockResult<T = unknown> =
  | { acquired: true; cachedResult: null; timedOut: false }
  | { acquired: false; cachedResult: T | null; timedOut: false }
  | { acquired: false; cachedResult: null; timedOut: true };

/**
 * Acquire a Redis lock or wait for result from another process
 *
 * This prevents duplicate work by:
 * 1. Trying to acquire lock with NX (only set if not exists)
 * 2. If lock acquired, caller does work and caches result
 * 3. If lock NOT acquired, poll for cached result until timeout
 *
 * @param options.lockKey - Redis key for the lock
 * @param options.resultKey - Redis key where result will be cached
 * @param options.lockTtl - Lock TTL in seconds (default 30)
 * @param options.pollIntervalMs - How often to check for result (default 250ms)
 * @param options.maxWaitMs - Max time to wait for result (default 25000ms)
 * @returns Lock status and any cached result
 */
export async function acquireLockOrWaitForResult<T = unknown>(options: {
  lockKey: string;
  resultKey: string;
  lockTtl?: number;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<LockResult<T>> {
  const {
    lockKey,
    resultKey,
    lockTtl = 30,
    pollIntervalMs = 250,
    maxWaitMs = 25000,
  } = options;

  // Try to acquire lock
  try {
    const setRes = await redis.set(lockKey, "1", {
      nx: true,
      ex: lockTtl,
    });
    const acquired = Boolean(setRes);

    if (acquired) {
      console.debug(`[cache] redis lock acquired ${lockKey}`);
      return { acquired: true, cachedResult: null, timedOut: false };
    }

    console.debug(
      `[cache] redis lock not acquired ${lockKey} maxWait=${maxWaitMs}ms`,
    );
  } catch (err) {
    console.warn(
      `[cache] redis lock acquisition failed ${lockKey}`,
      err instanceof Error ? err : new Error(String(err)),
    );
    // If Redis is down, fail open (don't wait)
    return { acquired: true, cachedResult: null, timedOut: false };
  }

  // Lock not acquired, poll for result
  const startTime = Date.now();
  let pollCount = 0;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      pollCount++;
      // Batch check for result and lock existence in parallel
      const [result, lockExists] = await Promise.all([
        redis.get(resultKey) as Promise<T | null>,
        redis.exists(lockKey),
      ]);

      if (result !== null) {
        console.debug(
          `[cache] redis cache hit waiting ${resultKey} polls=${pollCount} duration=${Date.now() - startTime}ms`,
        );
        return { acquired: false, cachedResult: result, timedOut: false };
      }

      // Check if lock still exists - if not, the other process may have failed
      if (!lockExists) {
        console.warn(
          `[cache] redis lock disappeared ${lockKey} polls=${pollCount}`,
        );
        // Lock gone but no result - other process likely failed
        // Try to acquire lock ourselves
        const retryRes = await redis.set(lockKey, "1", {
          nx: true,
          ex: lockTtl,
        });
        const retryAcquired = Boolean(retryRes);
        if (retryAcquired) {
          return { acquired: true, cachedResult: null, timedOut: false };
        }
      }
    } catch (err) {
      console.warn(
        `[cache] redis polling error ${lockKey}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    await sleep(pollIntervalMs);
  }

  console.warn(
    `[cache] redis wait timeout ${lockKey} polls=${pollCount} duration=${Date.now() - startTime}ms`,
  );

  return { acquired: false, cachedResult: null, timedOut: true };
}

type CachedAssetOptions<TProduceMeta extends Record<string, unknown>> = {
  /**
   * Index key for the Redis cache
   */
  indexKey: string;
  /**
   * Lock key for the Redis cache
   */
  lockKey: string;
  /**
   * TTL in seconds for the Redis cache
   * @default 604800 (7 days)
   */
  ttlSeconds?: number;
  /**
   * Grace period in seconds to add to blob deletion schedule beyond Redis TTL
   * This prevents race conditions where Redis expires but blob hasn't been pruned yet
   * @default 86400 (24 hours)
   */
  blobGracePeriodSeconds?: number;
  /**
   * Produce and upload the asset, returning { url, key } and any metrics to attach
   */
  produceAndUpload: () => Promise<{
    url: string | null;
    key?: string;
    metrics?: TProduceMeta;
  }>;
  /**
   * Purge queue name (zset) for scheduling deletes by expiresAtMs
   * If provided and key is returned, will zadd(key, expiresAtMs)
   */
  purgeQueue?: string;
};

export async function getOrCreateCachedAsset<T extends Record<string, unknown>>(
  options: CachedAssetOptions<T>,
): Promise<{ url: string | null }> {
  const {
    indexKey,
    lockKey,
    ttlSeconds = 604800, // 7 days default
    blobGracePeriodSeconds = 86400, // 24 hours default
    produceAndUpload,
    purgeQueue,
  } = options;

  // 1) Check index
  try {
    const raw = (await redis.get(indexKey)) as { url?: unknown } | null;
    if (raw && typeof raw === "object") {
      const cachedUrl = (raw as { url?: unknown }).url;
      if (typeof cachedUrl === "string") {
        return { url: cachedUrl };
      }
      if (cachedUrl === null) {
        return { url: null };
      }
    }
  } catch (err) {
    console.debug(
      `[cache] redis index read failed ${indexKey}`,
      err instanceof Error ? err : new Error(String(err)),
    );
  }

  // 2) Acquire lock or wait
  const lockResult = await acquireLockOrWaitForResult<{ url: string | null }>({
    lockKey,
    resultKey: indexKey,
    lockTtl: Math.max(5, Math.min(120, ttlSeconds)),
  });

  // Handle timeout scenario - try to acquire lock ourselves as a fallback
  if (lockResult.timedOut) {
    console.warn(
      `[cache] timeout waiting for result ${indexKey}, attempting to acquire lock as fallback`,
    );
    // Try one more time to acquire the lock
    try {
      const retryRes = await redis.set(lockKey, "1", {
        nx: true,
        ex: Math.max(5, Math.min(120, ttlSeconds)),
      });
      if (retryRes) {
        console.debug(`[cache] lock acquired after timeout ${lockKey}`);
        // Proceed to do the work ourselves
      } else {
        // Still can't acquire, return null to avoid indefinite hang
        console.error(
          `[cache] failed to acquire lock after timeout ${lockKey}, returning null`,
        );
        return { url: null };
      }
    } catch (retryErr) {
      console.error(
        `[cache] lock retry failed after timeout ${lockKey}`,
        retryErr instanceof Error ? retryErr : new Error(String(retryErr)),
      );
      return { url: null };
    }
  } else if (!lockResult.acquired) {
    const cached = lockResult.cachedResult;
    if (cached && typeof cached === "object" && "url" in cached) {
      const cachedUrl = (cached as { url: string | null }).url;
      return { url: cachedUrl };
    }
    return { url: null };
  }

  // 3) Do work under lock
  try {
    const produced = await produceAndUpload();
    const expiresAtMs = Date.now() + ttlSeconds * 1000;
    // Schedule blob deletion AFTER Redis TTL + grace period to prevent race conditions
    const blobDeleteAtMs = expiresAtMs + blobGracePeriodSeconds * 1000;

    try {
      // Use pipeline to batch cache writes and lock release
      const pipeline = redis.pipeline();
      pipeline.set(
        indexKey,
        { url: produced.url, key: produced.key, expiresAtMs },
        { ex: ttlSeconds },
      );
      if (purgeQueue && produced.url) {
        pipeline.zadd(ns("purge", purgeQueue), {
          score: blobDeleteAtMs, // Use extended deadline for blob deletion
          member: produced.url,
        });
      }
      pipeline.del(lockKey);

      await pipeline.exec();
    } catch (err) {
      console.warn(
        `[cache] redis operations failed ${indexKey}`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }

    return { url: produced.url };
  } catch (produceErr) {
    // If production failed, still clean up the lock
    try {
      await redis.del(lockKey);
    } catch (delErr) {
      console.debug(
        `[cache] redis lock release failed ${lockKey}`,
        delErr instanceof Error ? delErr : new Error(String(delErr)),
      );
    }
    throw produceErr;
  }
}
