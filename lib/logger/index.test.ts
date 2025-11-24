import { describe, expect, it } from "vitest";
import {
  createLogEntry,
  formatLogEntry,
  getMinLogLevel,
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
  });

  describe("parseLogLevel", () => {
    it("returns the level if valid", () => {
      expect(parseLogLevel("info")).toBe("info");
      expect(parseLogLevel("debug")).toBe("debug");
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
});
