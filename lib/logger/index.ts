/**
 * Core Logger - Unified structured logging interface
 *
 * Provides a consistent logging API across server and client environments
 * with support for OpenTelemetry tracing and correlation IDs.
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogContext = Record<string, unknown>;

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: SerializedError;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  environment?: string;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
}

export interface Logger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
  fatal(message: string, error?: Error | unknown, context?: LogContext): void;
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

// PII-safe field allowlist - only these fields will be logged from context
const SAFE_FIELDS = new Set([
  "domain",
  "type",
  "types",
  "limit",
  "path",
  "method",
  "status",
  "statusCode",
  "durationMs",
  "source",
  "component",
  "action",
  "provider",
  "recordType",
  "count",
  "cached",
  "ttl",
  "expiresAt",
  "attempts",
  "backoffMs",
]);

// ============================================================================
// Utilities
// ============================================================================

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
 * Filter context to only include PII-safe fields and truncate long values.
 * This prevents accidentally logging sensitive information.
 */
export function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context || typeof context !== "object") {
    return undefined;
  }

  const sanitized: LogContext = {};
  let hasFields = false;

  for (const key of Object.keys(context)) {
    if (SAFE_FIELDS.has(key)) {
      const value = context[key];
      // Truncate strings to 200 chars max
      if (typeof value === "string" && value.length > 200) {
        sanitized[key] = `${value.slice(0, 200)}...`;
      } else {
        sanitized[key] = value;
      }
      hasFields = true;
    }
  }

  return hasFields ? sanitized : undefined;
}

/**
 * Serialize an error object for logging.
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

/**
 * Format a log entry as JSON string for output.
 */
export function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Create a structured log entry with all metadata.
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  options?: {
    context?: LogContext;
    error?: Error | unknown;
    correlationId?: string;
    traceId?: string;
    spanId?: string;
  },
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  // Add sanitized context
  const sanitized = sanitizeContext(options?.context);
  if (sanitized) {
    entry.context = sanitized;
  }

  // Add error if present
  if (options?.error) {
    entry.error = serializeError(options.error);
  }

  // Add correlation/trace IDs if present
  if (options?.correlationId) {
    entry.correlationId = options.correlationId;
  }
  if (options?.traceId) {
    entry.traceId = options.traceId;
  }
  if (options?.spanId) {
    entry.spanId = options.spanId;
  }

  // Add environment
  if (process.env.NODE_ENV) {
    entry.environment = process.env.NODE_ENV;
  }

  return entry;
}
