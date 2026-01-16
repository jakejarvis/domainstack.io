import { Redis } from "@upstash/redis";

/**
 * Lazy-initialized Redis client.
 * Deferred to avoid errors when env vars aren't set (e.g., in tests).
 */
let redis: Redis | null = null;

/**
 * Get the shared Redis client instance.
 *
 * Uses Upstash Redis with HTTP-based connection (serverless-friendly).
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 *
 * @returns Redis client instance
 */
export function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}
