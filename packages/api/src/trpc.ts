import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { flattenError, ZodError } from "zod";

import type { RateLimitConfig } from "@domainstack/redis/ratelimit";

import type { Context } from "./context";

/**
 * Procedure metadata for configuring middleware behavior.
 */
export type ProcedureMeta = {
  /**
   * Rate limit for this procedure. Defaults to 60 requests/minute.
   * Pass `false` to skip (protected procedures only; public resolvers
   * should omit the `rateLimit()` call instead).
   *
   * @example
   * ```ts
   * .meta({ rateLimit: { requests: 10, window: "1 m" } })
   * .meta({ rateLimit: false })
   * ```
   */
  rateLimit?: RateLimitConfig | false;
};

export const t = initTRPC
  .context<Context>()
  .meta<ProcedureMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.code === "BAD_REQUEST" && error.cause instanceof ZodError
              ? flattenError(error.cause)
              : null,
        },
      };
    },
  });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

// Re-export TRPCError for convenience
export { TRPCError };
