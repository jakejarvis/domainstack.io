import "server-only";

import { TRPCError } from "@trpc/server";
import { Ratelimit } from "@upstash/ratelimit";
import { after } from "next/server";
import { getRateLimits, type ServiceLimits } from "@/lib/edge-config";
import { redis } from "@/lib/redis";

export type ServiceName = keyof ServiceLimits;

/**
 * Assert that a rate limit is not exceeded for a given service and IP address.
 * @param service - The service name
 * @param ip - The IP address
 * @returns The rate limit result
 * @throws TRPCError if the rate limit is exceeded
 */
export async function assertRateLimit(
  service: ServiceName,
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
