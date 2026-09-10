import { Redis } from "@upstash/redis";

import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "redis" });

/**
 * Lazy-initialized Redis client.
 * Deferred to avoid errors when env vars aren't set (e.g., in tests).
 */
let redis: Redis | undefined;

/**
 * Get the shared Redis client instance.
 *
 * Uses Upstash Redis with HTTP-based connection (serverless-friendly).
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 *
 * @returns Redis client instance, or undefined if not configured
 */
export function getRedis(): Redis | undefined {
  // Mirror the fallbacks in `Redis.fromEnv`, which also accepts the
  // `KV_REST_API_*` pair used by Vercel KV. Checking only the `UPSTASH_*`
  // names would report "not configured" on a perfectly good Vercel KV setup.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    // `Redis.fromEnv` only warns on a missing pair and hands back a client
    // whose every call fails. Callers all branch on `undefined` to fail open,
    // so return that instead of a client that cannot work.
    const message =
      "Redis is not configured (set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN); continuing without it";
    // Expected locally, but in production it silently drops rate limiting and
    // session caching, so it should page rather than blend into the logs.
    if (process.env.NODE_ENV === "production") {
      logger.error(message);
    } else {
      logger.warn(message);
    }
    return undefined;
  }

  if (!redis) {
    redis = new Redis({ url, token });
  }

  return redis;
}

// Re-export the Redis type for consumers
export { Redis } from "@upstash/redis";
