import { Redis } from "@upstash/redis";

import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "redis" });

/**
 * Per-config Redis client cache. The default client (no overrides) and any
 * variant (e.g. auto-deserialization disabled) each get their own singleton so
 * we don't reconnect on every call.
 */
const clientCache = new Map<string, Redis>();

export type GetRedisOptions = {
  /**
   * Disable Upstash's automatic JSON (de)serialization. With this off, strings
   * round-trip verbatim — required by consumers that store opaque strings (e.g.
   * Better Auth's secondary storage). Leave enabled for callers that rely on
   * auto-deserialization (rate limiting, app caches). Defaults to enabled.
   */
  automaticDeserialization?: boolean;
};

/**
 * Get a shared Redis client instance.
 *
 * Uses Upstash Redis with HTTP-based connection (serverless-friendly).
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 *
 * @param options - Optional client config overrides (cached per distinct config)
 * @returns Redis client instance, or undefined if not configured
 */
export function getRedis(options?: GetRedisOptions): Redis | undefined {
  if (
    process.env.NODE_ENV !== "production" &&
    (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    logger.warn("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set");
    // Don't block app if Redis is not set in development
    return undefined;
  }

  const automaticDeserialization = options?.automaticDeserialization ?? true;
  const cacheKey = `autoDeser:${automaticDeserialization}`;

  let client = clientCache.get(cacheKey);
  if (!client) {
    client = automaticDeserialization
      ? Redis.fromEnv()
      : new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL as string,
          token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
          automaticDeserialization: false,
        });
    clientCache.set(cacheKey, client);
  }

  return client;
}

/**
 * Create a Redis client from explicit configuration.
 * Use this when environment variables are not available.
 *
 * @param config - Redis connection configuration
 * @returns Redis client instance
 */
export function createRedisClient(config: { url: string; token: string }): Redis {
  return new Redis({
    url: config.url,
    token: config.token,
  });
}

// Re-export the Redis type for consumers
export { Redis } from "@upstash/redis";
