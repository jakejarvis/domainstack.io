import { TRPCError } from "@trpc/server";
import { waitUntil } from "@vercel/functions";

import {
  DEFAULT_RATE_LIMIT,
  getRateLimiter,
  type RateLimitConfig,
  type RateLimitInfo,
} from "@domainstack/redis/ratelimit";

import type { Context } from "./context";

/**
 * Enforce rate limiting for a procedure call.
 *
 * Use this from a resolver when the check must run after other work
 * (e.g. a cache lookup). Procedures that always consume a token should use
 * `withRateLimit` via `protectedProcedure`.
 *
 * Rate limit key priority:
 * 1. Authenticated user ID (more accurate per-user limits)
 * 2. Client IP address (fallback for anonymous requests)
 *
 * Fail-open strategy:
 * - No identifier available: Skip rate limiting
 * - Redis timeout/error: Allow request (handled by library with 2s timeout)
 *
 * On limit exceeded: throws TOO_MANY_REQUESTS with retry timing in message and cause.
 * Does not mutate procedure output — remaining/limit live on the error cause only.
 *
 * @returns RateLimitInfo when a check ran successfully, otherwise undefined
 */
export async function rateLimit({
  ctx,
  path,
  config = DEFAULT_RATE_LIMIT,
}: {
  ctx: Context;
  path: string;
  config?: RateLimitConfig | false;
}): Promise<RateLimitInfo | undefined> {
  if (config === false || process.env.NODE_ENV === "development") {
    return undefined;
  }

  const limiter = getRateLimiter(config);

  // Fail open: no Redis or no identifier = skip rate limiting entirely
  if (!limiter) {
    return undefined;
  }

  // Build rate limiter with procedure path as the id prefix
  // This ensures each procedure has its own rate limit bucket in Redis
  const identifier = ctx.session?.user?.id ?? ctx.ip;

  // Fail open: no identifier = skip rate limiting
  if (!identifier) {
    return undefined;
  }

  const rateLimitResult = await limiter.limit(`${path}:${identifier}`).catch(() => null);

  // Fail open: Redis errors allow the request through
  if (!rateLimitResult) {
    return undefined;
  }

  const { success, limit, remaining, reset, pending } = rateLimitResult;

  // Handle analytics write after the response (or immediately outside a request)
  waitUntil(pending);

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

  return rateLimitInfo;
}
