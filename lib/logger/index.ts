/**
 * Core Logger - Unified structured logging interface
 *
 * Provides a consistent logging API across server and client environments:
 * - Server: Pino-based structured JSON logging (high-performance, stdout-only)
 * - Client: Console-based structured logging for browser environments
 *
 * Design notes:
 * - Critical errors are tracked in PostHog via analytics.trackException()
 * - Log output goes to stdout (Vercel runtime logs)
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogContext = Record<string, unknown>;

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
}

export interface Logger {
  /** Generic log method - useful for dynamic log levels or library adapters */
  log(level: LogLevel, message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;

  // Overloaded signatures for warn/error/fatal to support optional error objects
  // Usage:
  //   logger.warn("message", { context })              - context only
  //   logger.warn("message", error)                    - error only (auto-detected)
  //   logger.warn("message", error, { context })       - both error and context
  warn(message: string, error: unknown, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;

  error(message: string, error: unknown, context?: LogContext): void;
  error(message: string, context?: LogContext): void;

  fatal(message: string, error: unknown, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Validate and parse a log level string.
 * Returns undefined if the level is invalid.
 */
export function parseLogLevel(level?: string): LogLevel | undefined {
  if (!level) return undefined;
  const validLevels: LogLevel[] = [
    "trace",
    "debug",
    "info",
    "warn",
    "error",
    "fatal",
  ];
  if (validLevels.includes(level as LogLevel)) {
    return level as LogLevel;
  }
  return undefined;
}

/**
 * Get the minimum log level based on environment.
 * - Development: debug
 * - Production: info
 * - Test: warn (to reduce noise)
 */
export function getMinLogLevel(): LogLevel {
  if (process.env.NODE_ENV === "test") {
    return "warn";
  }
  if (process.env.NODE_ENV === "development") {
    return "debug";
  }
  return "info";
}

/**
 * Check if a log level should be emitted based on current minimum level.
 */
export function shouldLog(
  level: LogLevel,
  minLevel: LogLevel = getMinLogLevel(),
): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * Check if a value looks like an Error object.
 * Used to disambiguate error vs context in overloaded log methods.
 */
export function isErrorLike(value: unknown): boolean {
  return (
    value instanceof Error ||
    (typeof value === "object" &&
      value !== null &&
      "message" in value &&
      "stack" in value)
  );
}

/**
 * Serialize an error object for logging.
 * Converts Error objects to a structured format suitable for log records.
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  // Handle non-Error objects: try safe JSON serialization first
  if (error && typeof error === "object") {
    try {
      // Attempt safe JSON stringify with cycle protection
      const cache = new Set();
      const json = JSON.stringify(error, (_key, value) => {
        if (typeof value === "object" && value !== null) {
          if (cache.has(value)) {
            return "[Circular]";
          }
          cache.add(value);
        }
        return value;
      });
      return {
        name: "UnknownError",
        message: json,
      };
    } catch {
      // JSON.stringify failed - fall back to String()
      return {
        name: "UnknownError",
        message: String(error),
      };
    }
  }

  // Primitive values
  return {
    name: "UnknownError",
    message: String(error),
  };
}
