import { Redis } from "@upstash/redis";
import { createLogger } from "@/lib/logger/server";

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
 * @returns Redis client instance
 */
export function getRedis(): Redis | undefined {
  if (
    process.env.NODE_ENV === "development" &&
    (!process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    logger.warn(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set",
    );
    // Don't block app if Redis is not set in development
    return undefined;
  }

  if (!redis) {
    redis = Redis.fromEnv();
  }

  return redis;
}
