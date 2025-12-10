/**
 * Core Logger - Unified structured logging interface
 *
 * Provides a consistent logging API across server and client environments.
 * Server-side uses OpenTelemetry Logs API for automatic trace correlation.
 * Client-side uses structured console output with matching format.
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
  warn(message: string, context?: LogContext): void;
  // Overloaded signatures for flexible error/fatal logging
  // Pattern 1: error(message, error, context) - traditional with error object
  error(message: string, error: unknown, context?: LogContext): void;
  // Pattern 2: error(message, context) - compatible with various logging interfaces
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
 * Serialize an error object for logging.
 * Converts Error objects to a structured format suitable for log attributes.
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

  // Handle non-Error objects
  return {
    name: "UnknownError",
    message: String(error),
  };
}
