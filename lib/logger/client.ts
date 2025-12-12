"use client";

import {
  type LogContext,
  type Logger,
  type LogLevel,
  serializeError,
  shouldLog,
} from "@/lib/logger";

/**
 * Client-side logger with structured output.
 *
 * Features:
 * - Structured JSON logging format (consistent with server)
 * - Environment-based log level filtering
 * - PostHog error tracking for exceptions
 * - Graceful degradation (never crashes)
 */

// ============================================================================
// Logger Implementation
// ============================================================================

class ClientLogger implements Logger {
  private minLevel: LogLevel;

  constructor(minLevel?: LogLevel) {
    // Default to environment-based level
    this.minLevel =
      minLevel || (process.env.NODE_ENV === "development" ? "debug" : "info");
  }

  private formatLogRecord(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const record = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      ...(context && Object.keys(context).length > 0 ? { context } : {}),
    };
    return JSON.stringify(record);
  }

  private logInternal(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): void {
    if (!shouldLog(level, this.minLevel)) {
      return;
    }

    try {
      const formatted = this.formatLogRecord(level, message, context);

      // Output to appropriate console method
      // Only log to console in development to avoid noise in production
      if (process.env.NODE_ENV === "development") {
        switch (level) {
          case "trace":
          case "debug":
            console.debug(formatted);
            break;
          case "info":
            console.info(formatted);
            break;
          case "warn":
            console.warn(formatted);
            break;
          case "error":
          case "fatal":
            console.error(formatted);
            break;
        }
      }
    } catch (err) {
      // Logging should never crash the application
      console.error("[logger] failed to log:", err);
    }
  }

  private logWithError(
    level: "warn" | "error" | "fatal",
    message: string,
    errorOrContext?: unknown,
    context?: LogContext,
  ): void {
    if (!shouldLog(level, this.minLevel)) {
      return;
    }

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
      // Build log record with error at root level
      const record: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
      };

      // Add serialized error at root level
      if (error) {
        record.error = serializeError(error);
      }

      // Add context fields - filter out 'error' key to prevent clobbering
      if (finalContext && Object.keys(finalContext).length > 0) {
        const { error: _ignored, ...safeContext } = finalContext as Record<
          string,
          unknown
        >;
        Object.assign(record, safeContext);
      }

      const formatted = JSON.stringify(record);

      // Always output errors to console (even in production for debugging)
      console.error(formatted);

      // Track errors in PostHog (only error and fatal, not warnings)
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
      // Dynamically import analytics to avoid circular dependencies
      import("@/lib/analytics/client")
        .then(({ analytics }) => {
          analytics.trackException(error, {
            ...context,
            source: "logger",
          });
        })
        .catch(() => {
          // Graceful degradation - don't throw if PostHog fails
        });
    } catch {
      // Silently fail if analytics not available
    }
  }

  /** Generic log method for dynamic log levels or library adapters */
  log(level: LogLevel, message: string, context?: LogContext): void {
    switch (level) {
      case "trace":
        this.logInternal("trace", message, context);
        break;
      case "debug":
        this.logInternal("debug", message, context);
        break;
      case "info":
        this.logInternal("info", message, context);
        break;
      case "warn":
        this.logWithError("warn", message, undefined, context);
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
    this.logInternal("trace", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.logInternal("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.logInternal("info", message, context);
  }

  warn(message: string, error: unknown, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  warn(message: string, errorOrContext?: unknown, context?: LogContext): void {
    // Check if called with error object (3 args) or just context (2 args)
    if (context !== undefined) {
      // Three args: warn(message, error, context)
      this.logWithError("warn", message, errorOrContext, context);
    } else if (
      errorOrContext &&
      (errorOrContext instanceof Error ||
        (typeof errorOrContext === "object" &&
          "message" in errorOrContext &&
          "stack" in errorOrContext))
    ) {
      // Two args with error-like object: warn(message, error)
      this.logWithError("warn", message, errorOrContext, undefined);
    } else {
      // Two args with context: warn(message, context)
      this.logInternal(
        "warn",
        message,
        errorOrContext as LogContext | undefined,
      );
    }
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
    return createLogger(context);
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Singleton client logger instance.
 * Use this for all client-side logging.
 *
 * @example
 * ```typescript
 * import { logger } from "@/lib/logger/client";
 *
 * logger.info("Button clicked", { button: "export" });
 * logger.error("Export failed", error, { format: "json" });
 * ```
 */
export const logger = new ClientLogger();

/**
 * Create a child logger with a specific context prefix.
 * Useful for component-specific logging.
 *
 * @example
 * ```typescript
 * const searchLogger = createLogger({ component: "DomainSearch" });
 * searchLogger.debug("Query submitted", { domain: "example.com" });
 * ```
 */
export function createLogger(baseContext: LogContext): Logger {
  const childLogger = {
    log: (level: LogLevel, message: string, context?: LogContext) =>
      logger.log(level, message, { ...baseContext, ...context }),
    trace: (message: string, context?: LogContext) =>
      logger.trace(message, { ...baseContext, ...context }),
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...baseContext, ...context }),
    warn: (message: string, errorOrContext?: unknown, context?: LogContext) => {
      if (context !== undefined) {
        // Three args: warn(message, error, context)
        logger.warn(message, errorOrContext, { ...baseContext, ...context });
      } else if (
        errorOrContext &&
        (errorOrContext instanceof Error ||
          (typeof errorOrContext === "object" &&
            "message" in errorOrContext &&
            "stack" in errorOrContext))
      ) {
        // Two args with error: warn(message, error) - pass baseContext as 3rd arg
        logger.warn(message, errorOrContext, baseContext);
      } else {
        // Two args with context: warn(message, context) - merge contexts
        logger.warn(message, {
          ...baseContext,
          ...(errorOrContext as LogContext | undefined),
        });
      }
    },
    error: (
      message: string,
      errorOrContext?: unknown,
      context?: LogContext,
    ) => {
      if (context !== undefined) {
        // Three args: error(message, error, context)
        logger.error(message, errorOrContext, { ...baseContext, ...context });
      } else if (
        errorOrContext &&
        (errorOrContext instanceof Error ||
          (typeof errorOrContext === "object" &&
            "message" in errorOrContext &&
            "stack" in errorOrContext))
      ) {
        // Two args with error: error(message, error) - pass baseContext as 3rd arg
        logger.error(message, errorOrContext, baseContext);
      } else {
        // Two args with context: error(message, context) - merge contexts
        logger.error(message, {
          ...baseContext,
          ...(errorOrContext as LogContext | undefined),
        });
      }
    },
    fatal: (
      message: string,
      errorOrContext?: unknown,
      context?: LogContext,
    ) => {
      if (context !== undefined) {
        // Three args: fatal(message, error, context)
        logger.fatal(message, errorOrContext, { ...baseContext, ...context });
      } else if (
        errorOrContext &&
        (errorOrContext instanceof Error ||
          (typeof errorOrContext === "object" &&
            "message" in errorOrContext &&
            "stack" in errorOrContext))
      ) {
        // Two args with error: fatal(message, error) - pass baseContext as 3rd arg
        logger.fatal(message, errorOrContext, baseContext);
      } else {
        // Two args with context: fatal(message, context) - merge contexts
        logger.fatal(message, {
          ...baseContext,
          ...(errorOrContext as LogContext | undefined),
        });
      }
    },
    child: (context: LogContext) =>
      createLogger({ ...baseContext, ...context }),
  };

  return childLogger as Logger;
}
