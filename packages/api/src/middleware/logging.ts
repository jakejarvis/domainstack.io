import { createLogger } from "@domainstack/logger";

import { t } from "../trpc";

const logger = createLogger({ source: "trpc" });

/**
 * One canonical log line per procedure: path, type, duration, outcome,
 * and posthogDistinctId when the caller is authenticated.
 */
export const withLogging = t.middleware(async ({ path, type, ctx, next }) => {
  const start = performance.now();
  const result = await next();
  const durationMs = Math.round(performance.now() - start);
  const outcome = result.ok ? "ok" : "error";
  const posthogDistinctId = ctx.session?.user.id;

  const fields: Record<string, unknown> = {
    path,
    type,
    durationMs,
    outcome,
    ...(posthogDistinctId ? { posthogDistinctId } : {}),
  };

  if (result.ok) {
    logger.info(fields, "procedure completed");
  } else {
    logger.error({ ...fields, err: result.error }, "procedure completed");
  }

  return result;
});
