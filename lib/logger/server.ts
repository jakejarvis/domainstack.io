import "server-only";

import {
  type LogContext,
  type Logger,
  type LogLevel,
  serializeError,
} from "@/lib/logger";
import { createPinoInstance, type PinoLogger } from "@/lib/logger/pino-config";

/**
 * Server-side logger powered by Pino.
 *
 * Features:
 * - High-performance structured logging
 * - Pretty-printed colorized output in development (via pino-pretty)
 * - Raw JSON output in production for Vercel log aggregation
 * - Environment-based log level filtering
 * - PostHog integration for critical errors
 * - Graceful degradation (never crashes)
 */

// ============================================================================
// Logger Implementation
// ============================================================================

class ServerLogger implements Logger {
  private pinoInstance: PinoLogger;

  constructor(pinoLogger?: PinoLogger) {
    this.pinoInstance = pinoLogger || createPinoInstance();
  }

  /**
   * Pino uses (mergeObject, message) signature, but our interface uses (message, context).
   * This helper flips the arguments and calls the appropriate Pino method.
   */
  private logToPino(
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal",
    message: string,
    context?: LogContext,
  ): void {
    try {
      // Pino signature: logger[level](mergeObject, message)
      // Our signature: logger[level](message, context)
      // Flip them: context becomes the merge object
      this.pinoInstance[level](context || {}, message);
    } catch (err) {
      // Logging should never crash the application
      console.error("[logger] failed to log:", err);
    }
  }

  /**
   * Log with error handling - supports both error object and context-only calls.
   */
  private logWithError(
    level: "error" | "fatal",
    message: string,
    errorOrContext?: unknown,
    context?: LogContext,
  ): void {
    // Determine error and context based on number of arguments:
    // - 3 args: error(message, error, context) - traditional call
    // - 2 args: error(message, context) - flexible call for compatibility
    const error = context !== undefined ? errorOrContext : undefined;
    const finalContext =
      context !== undefined
        ? context
        : (errorOrContext as LogContext | undefined);

    try {
      // Build merge object with error at root level
      const mergeObject: Record<string, unknown> = {};

      // Add serialized error at root level
      if (error) {
        mergeObject.error = serializeError(error);
      }

      // Add context if present
      if (finalContext && Object.keys(finalContext).length > 0) {
        Object.assign(mergeObject, finalContext);
      }

      // Log using Pino
      this.pinoInstance[level](mergeObject, message);

      // Track critical errors in PostHog (async, non-blocking)
      if (error instanceof Error) {
        this.trackErrorInPostHog(error, finalContext);
      }
    } catch (err) {
      // Logging should never crash the application
      console.error("[logger] failed to log:", err);
    }
  }

  private trackErrorInPostHog(error: Error, context?: LogContext): void {
    try {
      // Import analytics directly - the trackException method already handles
      // wrapping itself in after() where appropriate, so we don't double-wrap here
      import("@/lib/analytics/server")
        .then(({ analytics }) => {
          analytics.trackException(error, {
            ...context,
            source: "logger",
          });
        })
        .catch(() => {
          // Graceful degradation
        });
    } catch {
      // Silently skip
    }
  }

  /** Generic log method for dynamic log levels or library adapters */
  log(level: LogLevel, message: string, context?: LogContext): void {
    switch (level) {
      case "trace":
        this.logToPino("trace", message, context);
        break;
      case "debug":
        this.logToPino("debug", message, context);
        break;
      case "info":
        this.logToPino("info", message, context);
        break;
      case "warn":
        this.logToPino("warn", message, context);
        break;
      case "error":
        this.logWithError("error", message, undefined, context);
        break;
      case "fatal":
        this.logWithError("fatal", message, undefined, context);
        break;
    }
  }

  trace(message: string, context?: LogContext): void {
    this.logToPino("trace", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.logToPino("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.logToPino("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logToPino("warn", message, context);
  }

  error(message: string, error: unknown, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  error(message: string, errorOrContext?: unknown, context?: LogContext): void {
    this.logWithError("error", message, errorOrContext, context);
  }

  fatal(message: string, error: unknown, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
  fatal(message: string, errorOrContext?: unknown, context?: LogContext): void {
    this.logWithError("fatal", message, errorOrContext, context);
  }

  child(context: LogContext): Logger {
    // Create a child Pino logger with the context as bindings
    const childPino = this.pinoInstance.child(context);
    // Wrap it in a new ServerLogger instance
    return new ServerLogger(childPino);
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Singleton server logger instance.
 * Use this for all server-side logging.
 *
 * @example
 * ```typescript
 * import { logger } from "@/lib/logger/server";
 *
 * logger.info("User logged in", { userId: "123" });
 * logger.error("Database connection failed", error, { table: "users" });
 * ```
 */
export const logger = new ServerLogger();

/**
 * Create a child logger with a specific context prefix.
 * Useful for service-specific logging.
 *
 * @example
 * ```typescript
 * const dnsLogger = createLogger({ service: "dns" });
 * dnsLogger.debug("Resolving domain", { domain: "example.com" });
 * ```
 */
export function createLogger(baseContext: LogContext): Logger {
  return logger.child(baseContext);
}
