import "server-only";

import {
  logs,
  type Logger as OtelLogger,
  SeverityNumber,
} from "@opentelemetry/api-logs";
import {
  type LogContext,
  type Logger,
  type LogLevel,
  parseLogLevel,
  serializeError,
  shouldLog,
} from "@/lib/logger";

/**
 * Server-side logger with OpenTelemetry integration.
 *
 * Features:
 * - OpenTelemetry Logs API for automatic trace/span correlation
 * - Vendor-independent (can export to any OTLP-compatible backend)
 * - Environment-based log level filtering
 * - PostHog integration for critical events
 * - Compatible with Vercel logs (via ConsoleLogRecordExporter)
 */

// ============================================================================
// OpenTelemetry Severity Mapping
// ============================================================================

/**
 * Map LogLevel to OpenTelemetry SeverityNumber.
 * See: https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
 */
const SEVERITY_MAP: Record<LogLevel, SeverityNumber> = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
  fatal: SeverityNumber.FATAL,
};

/**
 * OpenTelemetry-compatible attribute value types.
 * Matches AnyValueMap from @opentelemetry/api-logs.
 */
type LogAttributes = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[]
>;

// ============================================================================
// Logger Implementation
// ============================================================================

class ServerLogger implements Logger {
  private minLevel: LogLevel;
  private otelLogger: OtelLogger;

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

    // Get OpenTelemetry logger instance
    // The LoggerProvider is configured in instrumentation.ts
    this.otelLogger = logs.getLogger("domainstack");
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
      // Emit log record via OpenTelemetry
      // TraceId/SpanId are automatically added by the SDK from the active span context
      this.otelLogger.emit({
        severityNumber: SEVERITY_MAP[level],
        severityText: level.toUpperCase(),
        body: message,
        attributes: this.sanitizeAttributes(context),
      });
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
      const attributes: LogAttributes = {
        ...this.sanitizeAttributes(finalContext),
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

      // Emit log record via OpenTelemetry
      this.otelLogger.emit({
        severityNumber: SEVERITY_MAP[level],
        severityText: level.toUpperCase(),
        body: message,
        attributes,
      });

      // Track critical errors in PostHog (async, non-blocking)
      if ((level === "error" || level === "fatal") && error instanceof Error) {
        this.trackErrorInPostHog(error, finalContext);
      }
    } catch (err) {
      // Logging should never crash the application
      console.error("[logger] failed to log:", err);
    }
  }

  /**
   * Sanitize context attributes for OpenTelemetry.
   * OpenTelemetry only accepts primitive types and arrays of primitives.
   * Returns AnyValueMap-compatible object.
   */
  private sanitizeAttributes(context?: LogContext): LogAttributes | undefined {
    if (!context || Object.keys(context).length === 0) {
      return undefined;
    }

    const result: LogAttributes = {};
    for (const [key, value] of Object.entries(context)) {
      if (value === null || value === undefined) {
        continue;
      }

      const type = typeof value;
      if (type === "string" || type === "number" || type === "boolean") {
        result[key] = value as string | number | boolean;
      } else if (Array.isArray(value)) {
        // Only include if all elements are primitives
        if (
          value.every(
            (v) =>
              typeof v === "string" ||
              typeof v === "number" ||
              typeof v === "boolean",
          )
        ) {
          result[key] = value as string[] | number[] | boolean[];
        } else {
          // Stringify complex arrays
          result[key] = JSON.stringify(value);
        }
      } else {
        // Stringify objects
        result[key] = JSON.stringify(value);
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
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
