import { describe, expect, it } from "vitest";
import {
  BaseLogger,
  getMinLogLevel,
  type LogContext,
  type Logger,
  type LogLevel,
  parseLogLevel,
  resolveErrorAndContext,
  serializeError,
  shouldLog,
} from "./index";

describe("Logger Core", () => {
  describe("shouldLog", () => {
    it("filters logs based on minimum level", () => {
      expect(shouldLog("trace", "info")).toBe(false);
      expect(shouldLog("debug", "info")).toBe(false);
      expect(shouldLog("info", "info")).toBe(true);
      expect(shouldLog("warn", "info")).toBe(true);
      expect(shouldLog("error", "info")).toBe(true);
      expect(shouldLog("fatal", "info")).toBe(true);
    });

    it("respects environment-based minimum level", () => {
      // In test environment, min level should be "warn"
      expect(getMinLogLevel()).toBe("warn");
    });

    it("handles all log levels for generic log method dispatch", () => {
      // Verifies shouldLog works correctly for all levels that logger.log() might receive
      const levels = [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
      ] as const;

      // With minLevel "trace", all levels should log
      for (const level of levels) {
        expect(shouldLog(level, "trace")).toBe(true);
      }

      // With minLevel "fatal", only fatal should log
      for (const level of levels) {
        expect(shouldLog(level, "fatal")).toBe(level === "fatal");
      }
    });
  });

  describe("parseLogLevel", () => {
    it("returns the level if valid", () => {
      expect(parseLogLevel("info")).toBe("info");
      expect(parseLogLevel("debug")).toBe("debug");
    });

    it("parses all valid log levels", () => {
      // All levels that can be passed to logger.log(level, message)
      expect(parseLogLevel("trace")).toBe("trace");
      expect(parseLogLevel("debug")).toBe("debug");
      expect(parseLogLevel("info")).toBe("info");
      expect(parseLogLevel("warn")).toBe("warn");
      expect(parseLogLevel("error")).toBe("error");
      expect(parseLogLevel("fatal")).toBe("fatal");
    });

    it("returns undefined if invalid", () => {
      expect(parseLogLevel("invalid")).toBeUndefined();
      expect(parseLogLevel("")).toBeUndefined();
      expect(parseLogLevel(undefined)).toBeUndefined();
    });
  });

  describe("serializeError", () => {
    it("serializes Error objects", () => {
      const error = new Error("Test error");
      error.cause = "Root cause";

      const serialized = serializeError(error);
      expect(serialized.name).toBe("Error");
      expect(serialized.message).toBe("Test error");
      expect(serialized.stack).toBeDefined();
      expect(serialized.cause).toBe("Root cause");
    });

    it("handles non-Error objects", () => {
      const serialized = serializeError("string error");
      expect(serialized.name).toBe("UnknownError");
      expect(serialized.message).toBe("string error");
    });

    it("handles null error", () => {
      const serialized = serializeError(null);
      expect(serialized.name).toBe("UnknownError");
      expect(serialized.message).toBe("null");
    });

    it("handles undefined error", () => {
      const serialized = serializeError(undefined);
      expect(serialized.name).toBe("UnknownError");
      expect(serialized.message).toBe("undefined");
    });

    it("handles number error", () => {
      const serialized = serializeError(42);
      expect(serialized.name).toBe("UnknownError");
      expect(serialized.message).toBe("42");
    });
  });

  describe("resolveErrorAndContext", () => {
    it("handles 3 args: error and context both provided", () => {
      const error = new Error("test");
      const context = { userId: "123" };

      const result = resolveErrorAndContext(error, context);

      expect(result.error).toBe(error);
      expect(result.context).toBe(context);
    });

    it("handles 2 args with Error-like object", () => {
      const error = new Error("test");

      const result = resolveErrorAndContext(error, undefined);

      expect(result.error).toBe(error);
      expect(result.context).toBeUndefined();
    });

    it("handles 2 args with context object", () => {
      const context = { userId: "123" };

      const result = resolveErrorAndContext(context, undefined);

      expect(result.error).toBeUndefined();
      expect(result.context).toBe(context);
    });

    it("detects error-like objects with message and stack", () => {
      const errorLike = { message: "error", stack: "stack trace" };

      const result = resolveErrorAndContext(errorLike, undefined);

      expect(result.error).toBe(errorLike);
      expect(result.context).toBeUndefined();
    });

    it("handles undefined arguments", () => {
      const result = resolveErrorAndContext(undefined, undefined);

      expect(result.error).toBeUndefined();
      expect(result.context).toBeUndefined();
    });
  });

  describe("BaseLogger", () => {
    // Create a concrete implementation for testing
    class TestLogger extends BaseLogger {
      public outputCalls: Array<{
        level: LogLevel;
        message: string;
        context?: LogContext;
        error?: unknown;
      }> = [];

      protected output(
        level: LogLevel,
        message: string,
        context?: LogContext,
        error?: unknown,
      ): void {
        this.outputCalls.push({ level, message, context, error });
      }

      child(context: LogContext): Logger {
        return new TestLogger(this.minLevel, {
          ...this.baseContext,
          ...context,
        });
      }
    }

    it("respects log level filtering", () => {
      const logger = new TestLogger("warn");

      logger.trace("trace msg");
      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");
      logger.fatal("fatal msg");

      expect(logger.outputCalls).toHaveLength(3);
      expect(logger.outputCalls[0].level).toBe("warn");
      expect(logger.outputCalls[1].level).toBe("error");
      expect(logger.outputCalls[2].level).toBe("fatal");
    });

    it("merges base context with log context", () => {
      const logger = new TestLogger("trace", { service: "api" });

      logger.info("test", { userId: "123" });

      expect(logger.outputCalls).toHaveLength(1);
      expect(logger.outputCalls[0].context).toEqual({
        service: "api",
        userId: "123",
      });
    });

    it("resolves error overloads correctly - error only", () => {
      const logger = new TestLogger("trace");
      const error = new Error("test");

      logger.error("failed", error);

      expect(logger.outputCalls).toHaveLength(1);
      expect(logger.outputCalls[0].error).toBe(error);
      expect(logger.outputCalls[0].context).toEqual({});
    });

    it("resolves error overloads correctly - context only", () => {
      const logger = new TestLogger("trace");

      logger.error("failed", { userId: "123" });

      expect(logger.outputCalls).toHaveLength(1);
      expect(logger.outputCalls[0].error).toBeUndefined();
      expect(logger.outputCalls[0].context).toEqual({ userId: "123" });
    });

    it("resolves error overloads correctly - both error and context", () => {
      const logger = new TestLogger("trace");
      const error = new Error("test");

      logger.error("failed", error, { userId: "123" });

      expect(logger.outputCalls).toHaveLength(1);
      expect(logger.outputCalls[0].error).toBe(error);
      expect(logger.outputCalls[0].context).toEqual({ userId: "123" });
    });

    it("child logger inherits base context", () => {
      const parent = new TestLogger("trace", { service: "api" });
      const child = parent.child({ component: "auth" }) as TestLogger;

      child.info("test", { userId: "123" });

      expect(child.outputCalls).toHaveLength(1);
      expect(child.outputCalls[0].context).toEqual({
        service: "api",
        component: "auth",
        userId: "123",
      });
    });

    it("formats log records with all fields", () => {
      const logger = new TestLogger("trace", { service: "test" });
      const error = new Error("test error");

      logger.error("operation failed", error, { operation: "fetch" });

      const formatted = logger.formatLogRecord(
        "error",
        "operation failed",
        { service: "test", operation: "fetch" },
        error,
      );
      const parsed = JSON.parse(formatted);

      expect(parsed.level).toBe("error");
      expect(parsed.message).toBe("operation failed");
      expect(parsed.service).toBe("test");
      expect(parsed.operation).toBe("fetch");
      expect(parsed.error).toBeDefined();
      expect(parsed.error.name).toBe("Error");
      expect(parsed.error.message).toBe("test error");
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe("Logger interface", () => {
    /**
     * Factory to create a mock logger that satisfies the Logger interface.
     * Returns both the logger and its call log for assertions.
     */
    function createMockLogger(): {
      logger: Logger;
      calls: Array<{ method: string; args: unknown[] }>;
    } {
      const calls: Array<{ method: string; args: unknown[] }> = [];

      const logger: Logger = {
        log: (level: LogLevel, message: string, context?) => {
          calls.push({ method: "log", args: [level, message, context] });
        },
        trace: (message, context?) => {
          calls.push({ method: "trace", args: [message, context] });
        },
        debug: (message, context?) => {
          calls.push({ method: "debug", args: [message, context] });
        },
        info: (message, context?) => {
          calls.push({ method: "info", args: [message, context] });
        },
        warn: (message, context?) => {
          calls.push({ method: "warn", args: [message, context] });
        },
        error: (message, errorOrContext?, context?) => {
          calls.push({
            method: "error",
            args: [message, errorOrContext, context],
          });
        },
        fatal: (message, errorOrContext?, context?) => {
          calls.push({
            method: "fatal",
            args: [message, errorOrContext, context],
          });
        },
        child: () => logger,
      };

      return { logger, calls };
    }

    it("includes log method for dynamic level dispatch", () => {
      const { logger, calls } = createMockLogger();

      // Verify log method can be called with all levels
      const levels: LogLevel[] = [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
      ];
      for (const level of levels) {
        logger.log(level, `${level} message`, { source: "test" });
      }

      expect(calls).toHaveLength(6);
      expect(calls[0]).toEqual({
        method: "log",
        args: ["trace", "trace message", { source: "test" }],
      });
      expect(calls[5]).toEqual({
        method: "log",
        args: ["fatal", "fatal message", { source: "test" }],
      });
    });

    it("supports child logger creation", () => {
      const { logger } = createMockLogger();

      const childLogger = logger.child({ component: "test" });
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe("function");
    });
  });
});
