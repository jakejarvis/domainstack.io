import "server-only";

import { context, trace } from "@opentelemetry/api";
import {
  createLogEntry,
  formatLogEntry,
  type LogContext,
  type Logger,
  type LogLevel,
  parseLogLevel,
  shouldLog,
} from "@/lib/logger";

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

  private logInternal(
    level: LogLevel,
    message: string,
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
      const { traceId, spanId } = getTraceContext();
      const correlationId = getCorrelationId();

      const entry = createLogEntry(level, message, {
        context: finalContext,
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
        this.trackErrorInPostHog(error, finalContext, correlationId);
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
      // Import analytics directly - the trackException method already handles
      // wrapping itself in after() where appropriate, so we don't double-wrap here
      import("@/lib/analytics/server")
        .then(({ analytics }) => {
          analytics.trackException(error, {
            ...context,
            correlationId,
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
