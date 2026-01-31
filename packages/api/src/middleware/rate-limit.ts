import {
  getRateLimiter,
  type RateLimitInfo,
} from "@domainstack/redis/ratelimit";
import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { t } from "../trpc";

/**
 * Middleware to enforce rate limiting.
 *
 * Rate limit key priority:
 * 1. Authenticated user ID (more accurate per-user limits)
 * 2. Client IP address (fallback for anonymous requests)
 *
 * Reads rate limit config from procedure meta.
 * Configure per-procedure: `.meta({ rateLimit: { requests: 10, window: "1 m" } })`
 *
 * Fail-open strategy:
 * - No identifier available: Skip rate limiting, allow request
 * - Redis timeout/error: Allow request (handled by library with 2s timeout)
 *
 * Response augmentation:
 * - Success: Adds `rateLimit` field to response data with { limit, remaining, reset }
 * - Failure: Throws TOO_MANY_REQUESTS with retry timing in message and cause
 *
 * Client-side utilities in `@/lib/ratelimit/client` can parse both cases.
 */
export const withRateLimit = t.middleware(async ({ ctx, meta, path, next }) => {
  // Allow procedures to opt-out via meta
  if (meta?.skipRateLimit || process.env.NODE_ENV === "development") {
    return next();
  }

  // Use user ID for authenticated requests, fall back to IP for anonymous
  const limiter = getRateLimiter({
    requests: meta?.rateLimit?.requests ?? 60,
    window: meta?.rateLimit?.window ?? "1 m",
  });

  // Fail open: no Redis or no identifier = skip rate limiting entirely
  if (!limiter) {
    return next();
  }

  // Build rate limiter with procedure path as the id prefix
  // This ensures each procedure has its own rate limit bucket in Redis
  const { success, limit, remaining, reset, pending } = await limiter.limit(
    `${path}:${ctx.session?.user?.id ?? ctx.ip}`,
  );

  // Handle analytics write in background (non-blocking)
  after(() => pending);

  const rateLimitInfo = { limit, remaining, reset } satisfies RateLimitInfo;

  if (!success) {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Try again in ${retryAfter}s`,
      // Include structured data in cause for client-side parsing
      cause: { retryAfter, rateLimit: rateLimitInfo },
    });
  }

  // Execute the procedure and wrap response with rate limit info
  const result = await next({
    ctx: {
      ...ctx,
      rateLimit: rateLimitInfo,
    },
  });

  // Augment successful responses with rate limit metadata
  // Only augment plain objects, not arrays or primitives
  if (
    result.ok &&
    result.data &&
    typeof result.data === "object" &&
    !Array.isArray(result.data)
  ) {
    return {
      ...result,
      data: {
        ...result.data,
        rateLimit: rateLimitInfo,
      },
    };
  }

  return result;
});
