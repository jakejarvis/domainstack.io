import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";

/**
 * Ephemeral in-memory cache to reduce Redis calls.
 * Shared across all requests in the same process.
 */
const cache = new Map();

/**
 * Supported time windows for rate limiting.
 */
export type RateLimitWindow = "1 s" | "10 s" | "1 m" | "10 m" | "1 h" | "1 d";

/**
 * Rate limit configuration for a procedure.
 */
export type RateLimitConfig = {
  /** Maximum requests allowed in the window */
  requests: number;
  /** Time window (e.g., "1 m", "10 s", "1 h") */
  window: RateLimitWindow;
};

/**
 * Default rate limit: 60 requests per minute.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requests: 60,
  window: "1 m",
};

/**
 * Cache of rate limiter instances by config key.
 * Created lazily on first use.
 */
const limiters = new Map<string, Ratelimit>();

/**
 * Generate a cache key for a rate limit config.
 */
function configKey(config: RateLimitConfig): string {
  return `${config.requests}/${config.window}`;
}

/**
 * Get or create a rate limiter for the specified configuration.
 *
 * Limiters are cached by their config to avoid creating duplicates
 * when multiple procedures share the same rate limit.
 *
 * @param config - Rate limit configuration (requests + window)
 * @returns Configured Ratelimit instance
 *
 * @example
 * ```ts
 * const limiter = getRateLimiter({ requests: 10, window: "1 m" });
 * const result = await limiter.limit(ip);
 * ```
 */
export function getRateLimiter(
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): Ratelimit {
  const key = configKey(config);
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      prefix: `@upstash/ratelimit:${key}`,
      ephemeralCache: cache,
      timeout: 2000,
      analytics: true,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Default rate limiter instance (60 requests/minute).
 */
export const ratelimit = getRateLimiter();

/**
 * Rate limit result with timing metadata.
 */
export type RateLimitInfo = {
  limit: number;
  remaining: number;
  reset: number;
};
