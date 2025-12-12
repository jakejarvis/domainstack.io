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
 * - Environment-based log level filtering (LOG_LEVEL env var or defaults)
 * - PostHog integration for critical errors (via analytics.trackException)
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
  private logImpl(
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
  private logImplWithError(
    level: "warn" | "error" | "fatal",
    message: string,
    errorOrContext?: unknown,
    context?: LogContext,
  ): void {
    // Determine error and context based on arguments:
    // - 3 args (context !== undefined): error(message, error, context)
    // - 2 args with Error-like object: error(message, error)
    // - 2 args with plain object: error(message, context)
    let error: unknown;
    let finalContext: LogContext | undefined;

    if (context !== undefined) {
      // Three args: error(message, error, context)
      error = errorOrContext;
      finalContext = context;
    } else if (
      errorOrContext &&
      (errorOrContext instanceof Error ||
        (typeof errorOrContext === "object" &&
          "message" in errorOrContext &&
          "stack" in errorOrContext))
    ) {
      // Two args with error-like object: error(message, error)
      error = errorOrContext;
      finalContext = undefined;
    } else {
      // Two args with plain object: error(message, context)
      error = undefined;
      finalContext = errorOrContext as LogContext | undefined;
    }

    try {
      // Build merge object with error at root level
      const mergeObject: Record<string, unknown> = {};

      // Add serialized error at root level
      if (error) {
        mergeObject.error = serializeError(error);
      }

      // Add context fields - spread after error to prevent clobbering
      if (finalContext && Object.keys(finalContext).length > 0) {
        // Filter out 'error' key from context to prevent overwriting serialized error
        const { error: _ignored, ...safeContext } = finalContext as Record<
          string,
          unknown
        >;
        Object.assign(mergeObject, safeContext);
      }

      // Log using Pino
      this.pinoInstance[level](mergeObject, message);

      // Track critical errors in PostHog (async, non-blocking)
      // Only track error and fatal levels, not warnings
      if ((level === "error" || level === "fatal") && error instanceof Error) {
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
        this.logImpl("trace", message, context);
        break;
      case "debug":
        this.logImpl("debug", message, context);
        break;
      case "info":
        this.logImpl("info", message, context);
        break;
      case "warn":
        this.logImplWithError("warn", message, undefined, context);
        break;
      case "error":
        this.logImplWithError("error", message, undefined, context);
        break;
      case "fatal":
        this.logImplWithError("fatal", message, undefined, context);
        break;
    }
  }

  trace(message: string, context?: LogContext): void {
    this.logImpl("trace", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.logImpl("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.logImpl("info", message, context);
  }

  warn(message: string, error: unknown, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  warn(message: string, errorOrContext?: unknown, context?: LogContext): void {
    // Check if called with error object (3 args) or just context (2 args)
    if (context !== undefined) {
      // Three args: warn(message, error, context)
      this.logImplWithError("warn", message, errorOrContext, context);
    } else if (
      errorOrContext &&
      (errorOrContext instanceof Error ||
        (typeof errorOrContext === "object" &&
          "message" in errorOrContext &&
          "stack" in errorOrContext))
    ) {
      // Two args with error-like object: warn(message, error)
      this.logImplWithError("warn", message, errorOrContext, undefined);
    } else {
      // Two args with context: warn(message, context)
      this.logImpl("warn", message, errorOrContext as LogContext | undefined);
    }
  }

  error(message: string, error: unknown, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  error(message: string, errorOrContext?: unknown, context?: LogContext): void {
    this.logImplWithError("error", message, errorOrContext, context);
  }

  fatal(message: string, error: unknown, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
  fatal(message: string, errorOrContext?: unknown, context?: LogContext): void {
    this.logImplWithError("fatal", message, errorOrContext, context);
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
 * Useful for service-specific logging (e.g., per-service context).
 *
 * Note: Uses Pino's child logger feature for efficient context binding.
 * Does NOT use OTEL trace/span context injection.
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
