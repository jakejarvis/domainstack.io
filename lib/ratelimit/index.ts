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
  /**
   * Unique name identifying this rate limit bucket.
   * Used in Redis key prefix for per-endpoint isolation.
   * Examples: "screenshot:post", "dns:lookup", "trpc:getDomain"
   */
  name?: string;
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
 * Includes name for per-endpoint isolation.
 */
function configKey(config: RateLimitConfig): string {
  const base = `${config.requests}/${config.window}`;
  return config.name ? `${config.name}:${base}` : base;
}

/**
 * Get or create a rate limiter for the specified configuration.
 *
 * Limiters are cached by their config key (name + requests + window) to avoid
 * creating duplicates when multiple calls share the same rate limit.
 *
 * @param config - Rate limit configuration (name, requests, window)
 * @returns Configured Ratelimit instance
 *
 * @example
 * ```ts
 * // Named rate limiter (recommended for per-endpoint isolation)
 * const limiter = getRateLimiter({
 *   name: "screenshot:post",
 *   requests: 10,
 *   window: "1 m",
 * });
 *
 * // Anonymous rate limiter (shared bucket for same config)
 * const limiter = getRateLimiter({ requests: 60, window: "1 m" });
 * ```
 */
export function getRateLimiter(
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): Ratelimit {
  const key = configKey(config);
  let limiter = limiters.get(key);
  if (!limiter) {
    // Build prefix: use name if provided, otherwise fall back to config-based key
    const prefix = config.name
      ? `ratelimit:${config.name}`
      : `ratelimit:${config.requests}/${config.window}`;

    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      prefix,
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
