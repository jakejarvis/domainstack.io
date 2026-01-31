import type { RateLimitConfig } from "@domainstack/redis/ratelimit";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

/**
 * Procedure metadata for configuring middleware behavior.
 */
export type ProcedureMeta = {
  /**
   * Rate limit configuration for this procedure.
   * Defaults to 60 requests/minute if not specified.
   *
   * @example
   * ```ts
   * .meta({ rateLimit: { requests: 10, window: "1 m" } })
   * ```
   */
  rateLimit?: RateLimitConfig;

  /**
   * Skip rate limiting for this procedure.
   * Use for lightweight/cached endpoints that don't need throttling.
   */
  skipRateLimit?: boolean;
};

export const t = initTRPC
  .context<Context>()
  .meta<ProcedureMeta>()
  .create({ transformer: superjson });

export const createTRPCRouter = t.router;
// biome-ignore lint/nursery/useDestructuring: this is easier
export const createCallerFactory = t.createCallerFactory;

// Re-export TRPCError for convenience
export { TRPCError };
