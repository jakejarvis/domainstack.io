/**
 * Core Logger - Unified structured logging interface
 *
 * - Provides a consistent logging API across server and client environments
 * - Critical errors are tracked in PostHog via analytics.trackException()
 * - Shared BaseLogger implementation eliminates duplication
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

/**
 * Route formatted log to the appropriate console method.
 *
 * @param level - The log level
 * @param formatted - The pre-formatted JSON log string
 */
export function outputToConsole(level: LogLevel, formatted: string): void {
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

/**
 * Resolve error and context from overloaded method arguments.
 * Handles the 2-3 argument signature for warn/error/fatal methods.
 *
 * @example
 * ```typescript
 * // 3 args: (message, error, context)
 * resolveErrorAndContext(error, { userId: "123" })
 * // => { error, context: { userId: "123" } }
 *
 * // 2 args with Error: (message, error)
 * resolveErrorAndContext(error, undefined)
 * // => { error, context: undefined }
 *
 * // 2 args with context: (message, context)
 * resolveErrorAndContext({ userId: "123" }, undefined)
 * // => { error: undefined, context: { userId: "123" } }
 * ```
 */
export function resolveErrorAndContext(
  errorOrContext?: unknown,
  context?: LogContext,
): { error: unknown; context: LogContext | undefined } {
  if (context !== undefined) {
    // Three args: method(message, error, context)
    return { error: errorOrContext, context };
  }
  if (isErrorLike(errorOrContext)) {
    // Two args with Error-like object: method(message, error)
    return { error: errorOrContext, context: undefined };
  }
  // Two args with plain object: method(message, context)
  return {
    error: undefined,
    context: errorOrContext as LogContext | undefined,
  };
}

// ============================================================================
// Base Logger Implementation
// ============================================================================

/**
 * Abstract base logger with shared overload resolution logic.
 * Subclasses implement environment-specific output methods.
 */
export abstract class BaseLogger implements Logger {
  protected minLevel: LogLevel;
  protected baseContext: LogContext;

  constructor(minLevel?: LogLevel, baseContext?: LogContext) {
    this.minLevel = minLevel || getMinLogLevel();
    this.baseContext = baseContext || {};
  }

  /**
   * Abstract method for environment-specific output.
   * Subclasses implement this to route to appropriate console methods.
   */
  protected abstract output(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void;

  /**
   * Format a log record as JSON string.
   * Merges base context, additional context, and error serialization.
   *
   * Public for testing purposes.
   */
  public formatLogRecord(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): string {
    const record: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.baseContext,
    };

    // Add serialized error at root level
    if (error) {
      record.error = serializeError(error);
    }

    // Flatten context to root level, protecting reserved keys
    if (context && Object.keys(context).length > 0) {
      const {
        timestamp: _timestamp,
        level: _level,
        message: _message,
        error: _error,
        ...safeContext
      } = context as Record<string, unknown>;
      Object.assign(record, safeContext);
    }

    return JSON.stringify(record);
  }

  log(level: LogLevel, message: string, context?: LogContext): void {
    if (!shouldLog(level, this.minLevel)) {
      return;
    }

    const mergedContext = { ...this.baseContext, ...context };

    switch (level) {
      case "trace":
      case "debug":
      case "info":
        this.output(level, message, mergedContext);
        break;
      case "warn":
      case "error":
      case "fatal":
        this.output(level, message, mergedContext, undefined);
        break;
    }
  }

  trace(message: string, context?: LogContext): void {
    if (!shouldLog("trace", this.minLevel)) {
      return;
    }
    this.output("trace", message, { ...this.baseContext, ...context });
  }

  debug(message: string, context?: LogContext): void {
    if (!shouldLog("debug", this.minLevel)) {
      return;
    }
    this.output("debug", message, { ...this.baseContext, ...context });
  }

  info(message: string, context?: LogContext): void {
    if (!shouldLog("info", this.minLevel)) {
      return;
    }
    this.output("info", message, { ...this.baseContext, ...context });
  }

  warn(message: string, error: unknown, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  warn(message: string, errorOrContext?: unknown, context?: LogContext): void {
    if (!shouldLog("warn", this.minLevel)) {
      return;
    }

    const { error, context: resolvedContext } = resolveErrorAndContext(
      errorOrContext,
      context,
    );
    this.output(
      "warn",
      message,
      { ...this.baseContext, ...resolvedContext },
      error,
    );
  }

  error(message: string, error: unknown, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  error(message: string, errorOrContext?: unknown, context?: LogContext): void {
    if (!shouldLog("error", this.minLevel)) {
      return;
    }

    const { error, context: resolvedContext } = resolveErrorAndContext(
      errorOrContext,
      context,
    );
    this.output(
      "error",
      message,
      { ...this.baseContext, ...resolvedContext },
      error,
    );
  }

  fatal(message: string, error: unknown, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
  fatal(message: string, errorOrContext?: unknown, context?: LogContext): void {
    if (!shouldLog("fatal", this.minLevel)) {
      return;
    }

    const { error, context: resolvedContext } = resolveErrorAndContext(
      errorOrContext,
      context,
    );
    this.output(
      "fatal",
      message,
      { ...this.baseContext, ...resolvedContext },
      error,
    );
  }

  abstract child(context: LogContext): Logger;
}
