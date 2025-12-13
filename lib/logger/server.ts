import "server-only";

import {
  BaseLogger,
  type LogContext,
  type Logger,
  type LogLevel,
  outputToConsole,
} from "@/lib/logger";

/**
 * Server-side logger using console methods.
 *
 * Features:
 * - Structured JSON logging with proper console method routing
 * - PostHog integration for critical errors (via analytics.trackException)
 * - Graceful degradation (never crashes)
 */

// ============================================================================
// Logger Implementation
// ============================================================================

class ServerLogger extends BaseLogger {
  /**
   * Output logs using appropriate console methods.
   */
  protected output(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void {
    try {
      const formatted = this.formatLogRecord(level, message, context, error);

      // Route to correct console method
      outputToConsole(level, formatted);

      // Track critical errors in PostHog (async, non-blocking)
      // Only track error and fatal levels, not warnings
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

  child(context: LogContext): Logger {
    return new ServerLogger(this.minLevel, {
      ...this.baseContext,
      ...context,
    });
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
 * @example
 * ```typescript
 * const dnsLogger = createLogger({ service: "dns" });
 * dnsLogger.debug("Resolving domain", { domain: "example.com" });
 * ```
 */
export function createLogger(baseContext: LogContext): Logger {
  return logger.child(baseContext);
}
