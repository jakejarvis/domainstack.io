import "server-only";

import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

/**
 * Shared logger options.
 */
const baseOptions = {
  level: process.env.LOG_LEVEL ?? (isTest ? "warn" : isDev ? "debug" : "info"),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
};

/**
 * Server-side Pino logger.
 *
 * Features:
 * - Structured JSON logging (ndjson format)
 * - ISO timestamps for consistent ordering
 * - Standard error serialization
 * - Pretty printing in development only
 * - Routes warn/error/fatal to stderr for proper Vercel log coloring
 *
 * @example
 * ```typescript
 * import { logger } from "@/lib/logger/server";
 *
 * logger.info({ userId: "123" }, "User logged in");
 * logger.error({ err: error, table: "users" }, "Database connection failed");
 * ```
 */
export const logger: pino.Logger = isDev
  ? // Development: pretty printing to stdout (sync to avoid worker issues)
    pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, sync: true },
      },
    })
  : // Production: route error/fatal to stderr so Vercel shows them as red
    // Vercel parses JSON level field, so warn on stdout will be yellow
    pino(
      { ...baseOptions },
      pino.multistream([
        // trace, debug, info, warn -> stdout (Vercel parses level for coloring)
        { level: "trace", stream: process.stdout },
        // error, fatal -> stderr (Vercel shows these as red)
        { level: "error", stream: process.stderr },
      ]),
    );

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
export const createLogger = (bindings: Record<string, unknown>): pino.Logger =>
  logger.child(bindings);
