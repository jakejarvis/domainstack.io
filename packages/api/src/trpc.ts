import type { TRPC_ERROR_CODE_KEY } from "@trpc/server";
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

/**
 * Error codes this codebase raises on purpose. Their messages are written for
 * users and are safe to send to the browser.
 *
 * Anything else reached the client by accident (driver errors, TypeErrors,
 * upstream failures) and its message may carry schema names, query fragments,
 * or internal paths, so it is replaced with a generic string. The original is
 * still logged server-side by the logging middleware.
 *
 * Shared with the logging middleware so wire safety and server severity use
 * one deliberate-error policy.
 */
export const EXPECTED_ERROR_CODES = new Set<TRPC_ERROR_CODE_KEY>([
  "PARSE_ERROR",
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "UNPROCESSABLE_CONTENT",
  "PRECONDITION_REQUIRED",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

const REDACTED_MESSAGE = "An unexpected error occurred. Please try again.";

export const t = initTRPC
  .context<Context>()
  .meta<ProcedureMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape: errorResponse, error }) {
      const isExpected = EXPECTED_ERROR_CODES.has(error.code);

      return {
        ...errorResponse,
        message: isExpected ? errorResponse.message : REDACTED_MESSAGE,
        data: {
          ...errorResponse.data,
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
