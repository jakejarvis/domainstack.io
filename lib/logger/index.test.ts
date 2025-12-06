import { describe, expect, it } from "vitest";
import {
  createLogEntry,
  formatLogEntry,
  getMinLogLevel,
  type Logger,
  type LogLevel,
  parseLogLevel,
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
  });

  describe("createLogEntry", () => {
    it("creates a basic log entry", () => {
      const entry = createLogEntry("info", "Test message");

      expect(entry.level).toBe("info");
      expect(entry.message).toBe("Test message");
      expect(entry.timestamp).toBeDefined();
      expect(entry.environment).toBe("test");
    });

    it("creates entries for all log levels", () => {
      // Verifies createLogEntry works for all levels that logger.log() might use
      const levels = [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
      ] as const;

      for (const level of levels) {
        const entry = createLogEntry(level, `${level} message`);
        expect(entry.level).toBe(level);
        expect(entry.message).toBe(`${level} message`);
        expect(entry.timestamp).toBeDefined();
      }
    });

    it("includes context", () => {
      const entry = createLogEntry("info", "Test", {
        context: { domain: "example.com" },
      });

      expect(entry.context).toEqual({
        domain: "example.com",
      });
    });

    it("includes serialized error", () => {
      const error = new Error("Test error");
      const entry = createLogEntry("error", "Error occurred", { error });

      expect(entry.error?.name).toBe("Error");
      expect(entry.error?.message).toBe("Test error");
    });

    it("includes correlation and trace IDs", () => {
      const entry = createLogEntry("info", "Test", {
        correlationId: "corr-123",
        traceId: "trace-456",
        spanId: "span-789",
      });

      expect(entry.correlationId).toBe("corr-123");
      expect(entry.traceId).toBe("trace-456");
      expect(entry.spanId).toBe("span-789");
    });
  });

  describe("formatLogEntry", () => {
    it("formats log entry as JSON string", () => {
      const entry = createLogEntry("info", "Test message", {
        context: { domain: "example.com" },
      });

      const formatted = formatLogEntry(entry);
      const parsed = JSON.parse(formatted);

      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Test message");
      expect(parsed.context).toEqual({ domain: "example.com" });
    });
  });

  describe("Logger interface", () => {
    it("includes log method for dynamic level dispatch", () => {
      // Create a mock logger that satisfies the Logger interface
      // This verifies the interface shape at compile-time and runtime
      const calls: Array<{ method: string; args: unknown[] }> = [];

      const mockLogger: Logger = {
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
        child: () => mockLogger,
      };

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
        mockLogger.log(level, `${level} message`, { source: "test" });
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
  });
});
