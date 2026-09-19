import { TRPCError } from "@trpc/server";

import { enforceRateLimit, RateLimitError } from "@domainstack/redis/enforce";
import {
  DEFAULT_RATE_LIMIT,
  type RateLimitConfig,
  type RateLimitInfo,
} from "@domainstack/redis/ratelimit";

import type { Context } from "./context";

/**
 * Who a call is metered as: the signed-in user's id, else the client IP.
 * Missing means the call is unmetered (fail-open).
 */
export function rateLimitIdentifier(ctx: Context): string | null {
  return ctx.session?.user?.id ?? ctx.ip;
}

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
  return withTrpcRateLimitErrors(() =>
    enforceRateLimit({
      // Each procedure has its own rate limit bucket, keyed by its path
      key: path,
      identifier: rateLimitIdentifier(ctx),
      config,
    }),
  );
}

/**
 * Run `work`, translating a `RateLimitError` from `@domainstack/redis/enforce`
 * (which core lookups throw) into a TOO_MANY_REQUESTS `TRPCError`.
 */
export async function withTrpcRateLimitErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof RateLimitError) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: err.message,
        // Include structured data in cause for client-side parsing
        cause: { retryAfter: err.retryAfter, rateLimit: err.rateLimit },
      });
    }
    throw err;
  }
}
