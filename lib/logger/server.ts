import "server-only";

import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

/** Pino's built-in level name to numeric value mapping. */
const levels = pino.levels.values;

/**
 * Creates a destination stream that routes logs to the appropriate console method.
 *
 * This is safer than using process.stdout/stderr directly in serverless environments
 * like Vercel, as console methods are guaranteed to work and Vercel properly interprets
 * them for log level coloring.
 */
function createConsoleDestination(): pino.DestinationStream {
  return {
    write(msg: string): void {
      // Remove trailing newline for cleaner console output
      const trimmed = msg.trimEnd();

      try {
        const parsed = JSON.parse(trimmed) as { level?: string | number };
        const level =
          typeof parsed.level === "string"
            ? levels[parsed.level as keyof typeof levels]
            : parsed.level;

        // Route to appropriate console method based on log level
        if (typeof level === "number") {
          if (level >= levels.error) {
            console.error(trimmed);
          } else if (level >= levels.warn) {
            console.warn(trimmed);
          } else {
            console.log(trimmed);
          }
        } else {
          // Fallback for unknown level format
          console.log(trimmed);
        }
      } catch {
        // If JSON parsing fails, still output the message
        console.log(trimmed);
      }
    },
  };
}

/**
 * Shared logger options.
 */
const baseOptions: pino.LoggerOptions = {
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
 * - Uses console methods for safe Vercel log level translation
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
  : // Production: route logs to console methods for proper Vercel log coloring
    // console.error -> red, console.warn -> yellow, console.log -> default
    pino(baseOptions, createConsoleDestination());

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
