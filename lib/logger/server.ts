import "server-only";

import { context, trace } from "@opentelemetry/api";
import { after } from "next/server";
import {
  createLogEntry,
  formatLogEntry,
  type LogContext,
  type Logger,
  type LogLevel,
  parseLogLevel,
  shouldLog,
} from "@/lib/logger/index";

/**
 * Server-side logger with OpenTelemetry integration.
 *
 * Features:
 * - OpenTelemetry trace/span ID extraction
 * - Correlation ID support
 * - PostHog integration for critical events
 * - Environment-based log level filtering
 * - Compatible with Vercel logs
 */

// ============================================================================
// Context Management
// ============================================================================

// AsyncLocalStorage for correlation ID propagation
import { AsyncLocalStorage } from "node:async_hooks";

const correlationIdStorage = new AsyncLocalStorage<string>();

/**
 * Set correlation ID for the current async context.
 * This allows propagating the ID through async operations.
 */
export function setCorrelationId(id: string): void {
  correlationIdStorage.enterWith(id);
}

/**
 * Get correlation ID from the current async context.
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore();
}

/**
 * Run a function with a specific correlation ID context.
 */
export function withCorrelationId<T>(id: string, fn: () => T): T {
  return correlationIdStorage.run(id, fn);
}

// ============================================================================
// OpenTelemetry Integration
// ============================================================================

/**
 * Extract OpenTelemetry trace and span IDs from the current context.
 */
function getTraceContext(): { traceId?: string; spanId?: string } {
  try {
    const span = trace.getSpan(context.active());
    if (span) {
      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
      };
    }
  } catch {
    // OpenTelemetry not available or not configured
  }
  return {};
}

// ============================================================================
// Logger Implementation
// ============================================================================

class ServerLogger implements Logger {
  private minLevel: LogLevel;

  constructor(minLevel?: LogLevel) {
    // Default to environment-based level, but allow override
    this.minLevel =
      minLevel ||
      parseLogLevel(process.env.LOG_LEVEL) ||
      (process.env.NODE_ENV === "test"
        ? "warn"
        : process.env.NODE_ENV === "development"
          ? "debug"
          : "info");
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(level, this.minLevel)) {
      return;
    }

    try {
      const { traceId, spanId } = getTraceContext();
      const correlationId = getCorrelationId();

      const entry = createLogEntry(level, message, {
        context,
        correlationId,
        traceId,
        spanId,
      });

      const formatted = formatLogEntry(entry);

      // Output to appropriate console method
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
      const { traceId, spanId } = getTraceContext();
      const correlationId = getCorrelationId();

      const entry = createLogEntry(level, message, {
        context,
        error,
        correlationId,
        traceId,
        spanId,
      });

      const formatted = formatLogEntry(entry);

      // Output to console
      switch (level) {
        case "error":
        case "fatal":
          console.error(formatted);
          break;
        default:
          console.log(formatted);
          break;
      }

      // Track critical errors in PostHog (async, non-blocking)
      if ((level === "error" || level === "fatal") && error instanceof Error) {
        this.trackErrorInPostHog(error, context, correlationId);
      }
    } catch (err) {
      // Logging should never crash the application
      console.error("[logger] failed to log:", err);
    }
  }

  private trackErrorInPostHog(
    error: Error,
    context?: LogContext,
    correlationId?: string,
  ): void {
    try {
      // Use after() for non-blocking PostHog tracking
      after(async () => {
        try {
          const { analytics } = await import("@/lib/analytics/server");
          analytics.trackException(error, {
            ...context,
            correlationId,
            source: "logger",
          });
        } catch {
          // Graceful degradation - don't throw if PostHog fails
        }
      });
    } catch {
      // If after() not available, silently skip PostHog tracking
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
