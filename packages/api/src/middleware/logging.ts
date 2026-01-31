import { createLogger } from "@domainstack/logger";
import { t } from "../trpc";

/**
 * Middleware to log the start, end, and duration of a procedure.
 * Logs are automatically structured in JSON format.
 * Errors are tracked in PostHog for centralized monitoring.
 */
export const withLogging = t.middleware(async ({ path, type, next }) => {
  const start = performance.now();

  const procedureLogger = createLogger({ source: "trpc", path, type });

  const result = await next();
  const durationMs = Math.round(performance.now() - start);

  // Log errors from the result (tRPC middleware pattern)
  if (!result.ok) {
    procedureLogger.error({ err: result.error, durationMs }, "procedure error");
  }

  // Track slow requests (>5s threshold) in PostHog
  if (durationMs > 5000) {
    procedureLogger.info({ durationMs }, "slow request");

    try {
      const { analytics } = await import("@domainstack/analytics/server");
      void analytics.track("trpc_slow_request", {
        path,
        type,
        durationMs,
      });
    } catch {
      // Analytics import failed - don't crash the request
    }
  }

  return result;
});
