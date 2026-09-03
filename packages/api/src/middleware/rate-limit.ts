import { rateLimit } from "../rate-limit";
import { t } from "../trpc";

/**
 * Middleware to enforce rate limiting before the resolver runs.
 *
 * Attached to `protectedProcedure`. Public procedures call `rateLimit`
 * in the resolver so cache hits and cheap bail-outs can skip the budget.
 *
 * Reads rate limit config from procedure meta.
 * Configure per-procedure: `.meta({ rateLimit: { requests: 10, window: "1 m" } })`
 * Opt out with `.meta({ rateLimit: false })`.
 *
 * On limit exceeded: throws TOO_MANY_REQUESTS with retry timing in message and cause.
 */
export const withRateLimit = t.middleware(async ({ ctx, meta, path, next }) => {
  await rateLimit({ ctx, path, config: meta?.rateLimit });
  return next();
});
