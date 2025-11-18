import "server-only";

import { Ratelimit } from "@unkey/ratelimit";
import { getRateLimits } from "@/lib/edge-config";

/**
 * Rate limit configuration for each service.
 */
export type RateLimitConfig = {
  limit: number;
  duration: number;
};

/**
 * Service rate limits configuration.
 *
 * Each service has a request limit and duration window for rate limiting.
 * Example: { limit: 60, duration: 60000 } = 60 requests per minute (60000ms)
 */
export type ServiceLimits = {
  dns: RateLimitConfig;
  headers: RateLimitConfig;
  certs: RateLimitConfig;
  registration: RateLimitConfig;
  screenshot: RateLimitConfig;
  favicon: RateLimitConfig;
  seo: RateLimitConfig;
  hosting: RateLimitConfig;
  pricing: RateLimitConfig;
};
export type ServiceName = keyof ServiceLimits;

/**
 * Result of a rate limit check.
 */
export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Creates a configured Unkey rate limiter instance for a specific service.
 */
function createLimiter(
  service: ServiceName,
  config: RateLimitConfig,
): Ratelimit {
  const fallback = (identifier: string): RateLimitResult => {
    console.warn(
      `[ratelimit] timeout/error for ${service}:${identifier}, failing open`,
    );
    return {
      success: true, // Fail open on timeout/error
      limit: config.limit,
      remaining: config.limit,
      reset: Date.now() + config.duration,
    };
  };

  const rootKey = process.env.UNKEY_ROOT_KEY;
  if (!rootKey) {
    console.warn(
      "[ratelimit] UNKEY_ROOT_KEY not set, rate limiting disabled (fail open)",
    );
    // Return a no-op limiter that always succeeds
    return {
      limit: async () => ({
        success: true,
        limit: config.limit,
        remaining: config.limit,
        reset: Date.now() + config.duration,
      }),
    } as unknown as Ratelimit;
  }

  return new Ratelimit({
    rootKey,
    namespace: service,
    limit: config.limit,
    duration: config.duration, // Duration in milliseconds
    timeout: {
      ms: 3000, // Max wait before fallback
      fallback,
    },
    onError: (err: Error, identifier: string) => {
      console.error(`[ratelimit] ${service} - ${err.message}`);
      return fallback(identifier);
    },
  });
}

/**
 * Check rate limit for a service and IP address.
 * Returns result object - does NOT throw errors.
 *
 * @param service - The service name
 * @param ip - The IP address
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  service: ServiceName,
  ip: string,
): Promise<RateLimitResult> {
  const limits = await getRateLimits();

  // Fail open: if no limits configured or Edge Config fails
  if (limits === null) {
    console.info(`[ratelimit] rate limiting disabled (fail open)`);
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const cfg = limits[service];
  if (!cfg) {
    console.warn(`[ratelimit] no config for service ${service}, skipping`);
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const limiter = createLimiter(service, cfg);
  const result = await limiter.limit(ip);

  if (!result.success) {
    console.warn(
      `[ratelimit] blocked ${service} for ${ip} (limit=${result.limit}, remaining=${result.remaining})`,
    );
  }

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
