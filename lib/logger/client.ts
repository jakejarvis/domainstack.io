"use client";

import {
  BaseLogger,
  type LogContext,
  type Logger,
  type LogLevel,
  outputToConsole,
} from "@/lib/logger";

/**
 * Client-side logger with structured output.
 *
 * Features:
 * - Structured JSON logging format (consistent with server)
 * - Environment-based log level filtering
 * - Dev-only logging for info/debug (production silences these)
 * - PostHog error tracking for exceptions
 * - Graceful degradation (never crashes)
 */

// ============================================================================
// Logger Implementation
// ============================================================================

class ClientLogger extends BaseLogger {
  /**
   * Output logs using appropriate console methods.
   * In production, only errors are logged to reduce noise.
   */
  protected output(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void {
    try {
      const formatted = this.formatLogRecord(level, message, context, error);

      // In production, silence everything except errors
      const isDevelopment = process.env.NODE_ENV === "development";
      const isError = level === "error" || level === "fatal";

      if (!isDevelopment && !isError) {
        // Production: skip non-error logs
        return;
      }

      // Route to correct console method
      outputToConsole(level, formatted);

      // Track errors in PostHog (only error and fatal, not warnings)
      if (isError && error instanceof Error) {
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

  child(context: LogContext): Logger {
    return new ClientLogger(this.minLevel, {
      ...this.baseContext,
      ...context,
    });
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
  return logger.child(baseContext);
}
