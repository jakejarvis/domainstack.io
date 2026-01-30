import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

/**
 * Rate limit configuration for a procedure or API route.
 */
export type RateLimitConfig = {
  /**
   * Optional name for endpoint isolation in API routes.
   * Used as prefix in the rate limit identifier (e.g., "api:screenshot:post").
   * Not needed for tRPC procedures (they use the procedure path automatically).
   */
  name?: string;
  /** Maximum requests allowed in the window */
  requests: number;
  /** Time window (e.g., "1 m", "10 s", "1 h") */
  window: Duration;
};

/**
 * Default rate limit: 60 requests per minute.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requests: 60,
  window: "1 m",
};

/**
 * Ephemeral in-memory cache shared across all Ratelimit instances.
 * Reduces Redis calls by caching recent limit checks in-memory.
 */
const ephemeralCache = new Map();

/**
 * Cache of Ratelimit instances by config key.
 * Instances must be reused to benefit from the ephemeral cache.
 */
const instanceCache = new Map<string, Ratelimit>();

/**
 * Get or create a cached Ratelimit instance for the specified configuration.
 *
 * Instances are cached by their config (requests + window) to ensure the
 * ephemeral in-memory cache is shared across requests with the same limits.
 *
 * Per-endpoint isolation is achieved via the identifier passed to .limit(),
 * not by creating separate instances.
 *
 * @param config - Rate limit configuration
 * @returns Cached Ratelimit instance, or null if Redis unavailable
 */
export function getRateLimiter(config: RateLimitConfig): Ratelimit | null {
  const redis = getRedis();
  if (!redis) {
    return null;
  }

  const cacheKey = `${config.requests}:${config.window}`;
  let limiter = instanceCache.get(cacheKey);

  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      ephemeralCache,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      analytics: true,
    });
    instanceCache.set(cacheKey, limiter);
  }

  return limiter;
}

/**
 * Rate limit result with timing metadata.
 */
export type RateLimitInfo = {
  limit: number;
  remaining: number;
  reset: number;
};
