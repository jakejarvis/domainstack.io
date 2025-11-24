"use client";

import { getOrGenerateClientCorrelationId } from "@/lib/logger/correlation";
import {
  createLogEntry,
  formatLogEntry,
  type LogContext,
  type Logger,
  type LogLevel,
  shouldLog,
} from "@/lib/logger/index";

/**
 * Client-side logger with PostHog integration.
 *
 * Features:
 * - Console output for debug/info in development
 * - PostHog error tracking for exceptions
 * - Correlation ID support
 * - Browser context (user agent, viewport)
 * - Graceful degradation (never crashes)
 */

// ============================================================================
// Logger Implementation
// ============================================================================

class ClientLogger implements Logger {
  private minLevel: LogLevel;
  private correlationId: string | undefined;

  constructor(minLevel?: LogLevel) {
    // Default to environment-based level
    this.minLevel =
      minLevel || (process.env.NODE_ENV === "development" ? "debug" : "info");

    // Initialize correlation ID (lazy loaded on first use)
    if (typeof window !== "undefined") {
      try {
        this.correlationId = getOrGenerateClientCorrelationId();
      } catch {
        // Gracefully handle any errors
      }
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(level, this.minLevel)) {
      return;
    }

    try {
      const entry = createLogEntry(level, message, {
        context,
        correlationId: this.correlationId,
      });

      const formatted = formatLogEntry(entry);

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
    error?: Error | unknown,
    context?: LogContext,
  ): void {
    if (!shouldLog(level, this.minLevel)) {
      return;
    }

    try {
      const entry = createLogEntry(level, message, {
        context,
        error,
        correlationId: this.correlationId,
      });

      const formatted = formatLogEntry(entry);

      // Always output errors to console (even in production for debugging)
      console.error(formatted);

      // Track errors in PostHog
      if ((level === "error" || level === "fatal") && error instanceof Error) {
        this.trackErrorInPostHog(error, context);
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
            correlationId: this.correlationId,
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

  trace(message: string, context?: LogContext): void {
    this.log("trace", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.logWithError("error", message, error, context);
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    this.logWithError("fatal", message, error, context);
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
  return {
    trace: (message: string, context?: LogContext) =>
      logger.trace(message, { ...baseContext, ...context }),
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      logger.warn(message, { ...baseContext, ...context }),
    error: (message: string, error?: Error | unknown, context?: LogContext) =>
      logger.error(message, error, { ...baseContext, ...context }),
    fatal: (message: string, error?: Error | unknown, context?: LogContext) =>
      logger.fatal(message, error, { ...baseContext, ...context }),
  };
}
