import "server-only";

import { TRPCError } from "@trpc/server";
import { Ratelimit } from "@upstash/ratelimit";
import { waitUntil } from "@vercel/functions";
import { getRateLimits, type ServiceLimits } from "@/lib/edge-config";
import { redis } from "@/lib/redis";
import { t } from "@/trpc/init";

export type ServiceName = keyof ServiceLimits;

export async function assertRateLimit(service: ServiceName, ip: string) {
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
    waitUntil?.(res.pending);
  } catch {
    // no-op
  }

  return { limit: res.limit, remaining: res.remaining, reset: res.reset };
}

export const rateLimitMiddleware = t.middleware(async ({ ctx, next, meta }) => {
  const service = (meta?.service ?? "") as ServiceName;
  if (!service || !ctx.ip) return next();
  await assertRateLimit(service, ctx.ip);
  return next();
});
