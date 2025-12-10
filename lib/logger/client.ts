"use client";

import {
  type LogContext,
  type Logger,
  type LogLevel,
  sanitizeAttributes,
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
 *
 * Note: Unlike server-side, client-side doesn't use OpenTelemetry SDK
 * (which is Node.js-only). Logs are output directly to console in a
 * structured format that matches the server-side OpenTelemetry output.
 */

// ============================================================================
// Severity Mapping (matches OpenTelemetry SeverityNumber for consistency)
// ============================================================================

const SEVERITY_MAP: Record<LogLevel, number> = {
  trace: 1, // SeverityNumber.TRACE
  debug: 5, // SeverityNumber.DEBUG
  info: 9, // SeverityNumber.INFO
  warn: 13, // SeverityNumber.WARN
  error: 17, // SeverityNumber.ERROR
  fatal: 21, // SeverityNumber.FATAL
};

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
    attributes?: Record<string, unknown>,
  ): string {
    const record = {
      timestamp: new Date().toISOString(),
      severityNumber: SEVERITY_MAP[level],
      severityText: level.toUpperCase(),
      body: message,
      ...(attributes && Object.keys(attributes).length > 0
        ? { attributes }
        : {}),
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
      const formatted = this.formatLogRecord(
        level,
        message,
        sanitizeAttributes(context),
      );

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
    level: LogLevel,
    message: string,
    errorOrContext?: unknown,
    context?: LogContext,
  ): void {
    if (!shouldLog(level, this.minLevel)) {
      return;
    }

    // Determine error and context based on number of arguments:
    // - 3 args: error(message, error, context) - traditional call
    // - 2 args: error(message, context) - flexible call for compatibility
    const error = context !== undefined ? errorOrContext : undefined;
    const finalContext =
      context !== undefined
        ? context
        : (errorOrContext as LogContext | undefined);

    try {
      // Build attributes including serialized error if present
      const attributes: Record<string, unknown> = {
        ...sanitizeAttributes(finalContext),
      };

      // Add serialized error to attributes
      if (error) {
        const serialized = serializeError(error);
        attributes["error.name"] = serialized.name;
        attributes["error.message"] = serialized.message;
        if (serialized.stack) {
          attributes["error.stack"] = serialized.stack;
        }
        if (serialized.cause !== undefined) {
          attributes["error.cause"] = String(serialized.cause);
        }
      }

      const formatted = this.formatLogRecord(level, message, attributes);

      // Always output errors to console (even in production for debugging)
      console.error(formatted);

      // Track errors in PostHog
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
        this.logInternal("warn", message, context);
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

  warn(message: string, context?: LogContext): void {
    this.logInternal("warn", message, context);
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
    warn: (message: string, context?: LogContext) =>
      logger.warn(message, { ...baseContext, ...context }),
    error: (
      message: string,
      errorOrContext?: unknown,
      context?: LogContext,
    ) => {
      if (context !== undefined) {
        // Three args: error(message, error, context)
        logger.error(message, errorOrContext, { ...baseContext, ...context });
      } else {
        // Two args: could be error(message, error) or error(message, context)
        logger.error(message, errorOrContext, baseContext);
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
      } else {
        // Two args: could be fatal(message, error) or fatal(message, context)
        logger.fatal(message, errorOrContext, baseContext);
      }
    },
    child: (context: LogContext) =>
      createLogger({ ...baseContext, ...context }),
  };

  return childLogger as Logger;
}
