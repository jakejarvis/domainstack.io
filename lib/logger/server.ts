import "server-only";

import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

/**
 * Server-side Pino logger.
 *
 * Features:
 * - Structured JSON logging (ndjson format)
 * - ISO timestamps for consistent ordering
 * - Standard error serialization
 * - Pretty printing in development only
 *
 * @example
 * ```typescript
 * import { logger } from "@/lib/logger/server";
 *
 * logger.info({ userId: "123" }, "User logged in");
 * logger.error({ err: error, table: "users" }, "Database connection failed");
 * ```
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isTest ? "warn" : isDev ? "debug" : "info"),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
  // Sync pretty printing in dev (no worker thread issues)
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, sync: true },
    },
  }),
});

/**
 * Create a child logger with a specific context prefix.
 * Useful for service-specific logging (e.g., per-service context).
 *
 * @example
 * ```typescript
 * const logger = createLogger({ source: "dns" });
 * logger.debug({ domain: "example.com" }, "Resolving domain");
 * // Output: {"level":"debug","source":"dns","domain":"example.com","msg":"Resolving domain"}
 * ```
 */
export const createLogger = (bindings: Record<string, unknown>) =>
  logger.child(bindings);
