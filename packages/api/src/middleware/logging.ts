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

  try {
    const result = await next();

    // Track slow requests (>5s threshold) in PostHog
    const durationMs = Math.round(performance.now() - start);
    if (durationMs > 5000) {
      procedureLogger.info({ durationMs }, "slow request");

      const { analytics } = await import("@domainstack/analytics/server");
      // Explicitly void the promise to avoid unhandled rejection warnings
      void analytics.track("trpc_slow_request", {
        path,
        type,
        durationMs,
      });
    }

    return result;
  } catch (err) {
    // Log error and re-throw
    procedureLogger.error(err);
    throw err;
  }
});
