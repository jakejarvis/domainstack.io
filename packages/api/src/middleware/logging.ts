import { createLogger } from "@domainstack/logger";

import { t } from "../trpc";

const logger = createLogger({ source: "trpc" });

const EXPECTED_ERROR_CODES = new Set([
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
  } else if (EXPECTED_ERROR_CODES.has(result.error.code)) {
    logger.info({ ...fields, code: result.error.code, err: result.error }, "procedure completed");
  } else {
    logger.error({ ...fields, code: result.error.code, err: result.error }, "procedure completed");
  }

  return result;
});
