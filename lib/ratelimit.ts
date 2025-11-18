import "server-only";

import { TRPCError } from "@trpc/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { after } from "next/server";
import { getRateLimits } from "@/lib/edge-config";

/**
 * Rate limit configuration for each service.
 */
export type RateLimitConfig = {
  points: number;
  window: `${number} ${"s" | "m" | "h"}`;
};

/**
 * Service rate limits configuration.
 *
 * Each service has a points budget and time window for rate limiting.
 * Example: { points: 60, window: "1 m" } = 60 requests per minute
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
 * Redis client for rate limiting only.
 *
 * Uses KV_REST_API_URL and KV_REST_API_TOKEN from Vercel KV integration.
 * All other caching uses Next.js Data Cache or Postgres.
 */
export const redis = Redis.fromEnv();

/**
 * Assert that a rate limit is not exceeded for a given service and IP address.
 * @param service - The service name
 * @param ip - The IP address
 * @returns The rate limit result
 * @throws TRPCError if the rate limit is exceeded
 */
export async function assertRateLimit(
  service: keyof ServiceLimits,
  ip: string,
): Promise<{ limit: number; remaining: number; reset: number }> {
  const limits = await getRateLimits();

  // Fail open: if no limits configured or Edge Config fails, skip rate limiting
  if (limits === null) {
    console.info(`[ratelimit] rate limiting disabled (fail open)`);
    return { limit: 0, remaining: 0, reset: 0 };
  }

  const cfg = limits[service];
  if (!cfg) {
    console.warn(`[ratelimit] no config for service ${service}, skipping`);
    return { limit: 0, remaining: 0, reset: 0 };
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(cfg.points, cfg.window),
    analytics: true,
  });

  const res = await limiter.limit(`${service}:${ip}`);

  if (!res.success) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((res.reset - Date.now()) / 1000),
    );

    console.warn(
      `[ratelimit] blocked ${service} for ${ip} (limit=${res.limit}, retry in ${retryAfterSec}s)`,
    );

    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded for ${service}. Try again in ${retryAfterSec}s.`,
      cause: {
        retryAfter: retryAfterSec,
        service,
        limit: res.limit,
        remaining: res.remaining,
        reset: res.reset,
      },
    });
  }

  // allow ratelimit analytics to be sent in background
  try {
    after(async () => {
      await res.pending;
    });
  } catch {
    // no-op
  }

  return { limit: res.limit, remaining: res.remaining, reset: res.reset };
}
