import { createLogger } from "@domainstack/logger";

import { t } from "../trpc";

/**
 * Middleware to log the start, end, and duration of a procedure.
 */
export const withLogging = t.middleware(async ({ path, type, next }) => {
  const start = performance.now();

  const procedureLogger = createLogger({ source: "trpc", path, type });

  const result = await next();
  const durationMs = Math.round(performance.now() - start);

  if (!result.ok) {
    procedureLogger.error({ err: result.error, durationMs }, "procedure error");
  }

  if (durationMs > 5000) {
    procedureLogger.info({ durationMs }, "slow request");
  }

  return result;
});
