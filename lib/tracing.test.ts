import { type Span, trace } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import {
  addSpanAttribute,
  addSpanAttributes,
  getCurrentSpan,
  withChildSpan,
  withChildSpanSync,
  withSpan,
  withSpanSync,
} from "./tracing";

describe("tracing utilities", () => {
  describe("withSpan", () => {
    it("wraps async function with automatic span", async () => {
      const mockSpan = {
        startSpan: vi.fn().mockReturnValue({
          end: vi.fn(),
          setStatus: vi.fn(),
          recordException: vi.fn(),
          setAttribute: vi.fn(),
        }),
      };

      vi.spyOn(trace, "getTracer").mockReturnValue(
        mockSpan as unknown as ReturnType<typeof trace.getTracer>,
      );

      const testFn = withSpan(
        { name: "test.operation", attributes: { test: "value" } },
        async (arg: string) => {
          return `result-${arg}`;
        },
      );

      const result = await testFn("input");

      expect(result).toBe("result-input");
      expect(mockSpan.startSpan).toHaveBeenCalledWith("test.operation", {
        attributes: { test: "value" },
      });
    });

    it("supports dynamic attributes from function args", async () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      vi.spyOn(trace, "getTracer").mockReturnValue({
        startSpan: vi.fn().mockReturnValue(mockSpan),
      } as unknown as ReturnType<typeof trace.getTracer>);

      const testFn = withSpan(
        ([domain]: [string]) => ({
          name: "dns.lookup",
          attributes: { domain },
        }),
        async (domain: string) => {
          return { records: [], domain };
        },
      );

      const result = await testFn("example.com");

      expect(result.domain).toBe("example.com");
      expect(trace.getTracer).toHaveBeenCalled();
    });

    it("records exceptions and sets error status", async () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      vi.spyOn(trace, "getTracer").mockReturnValue({
        startSpan: vi.fn().mockReturnValue(mockSpan),
      } as unknown as ReturnType<typeof trace.getTracer>);

      const testError = new Error("Test error");
      const testFn = withSpan({ name: "test.error" }, async () => {
        throw testError;
      });

      await expect(testFn()).rejects.toThrow("Test error");
      expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: 2, // ERROR
        message: "Test error",
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it("adds result metadata for arrays", async () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      vi.spyOn(trace, "getTracer").mockReturnValue({
        startSpan: vi.fn().mockReturnValue(mockSpan),
      } as unknown as ReturnType<typeof trace.getTracer>);

      const testFn = withSpan({ name: "test.array" }, async () => {
        return [1, 2, 3];
      });

      await testFn();

      expect(mockSpan.setAttribute).toHaveBeenCalledWith("result.count", 3);
    });
  });

  describe("withSpanSync", () => {
    it("wraps synchronous function with automatic span", () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      vi.spyOn(trace, "getTracer").mockReturnValue({
        startSpan: vi.fn().mockReturnValue(mockSpan),
      } as unknown as ReturnType<typeof trace.getTracer>);

      const testFn = withSpanSync({ name: "test.sync" }, (n: number) => {
        return n * 2;
      });

      const result = testFn(5);

      expect(result).toBe(10);
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it("records exceptions in sync functions", () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      vi.spyOn(trace, "getTracer").mockReturnValue({
        startSpan: vi.fn().mockReturnValue(mockSpan),
      } as unknown as ReturnType<typeof trace.getTracer>);

      const testError = new Error("Sync error");
      const testFn = withSpanSync({ name: "test.sync.error" }, () => {
        throw testError;
      });

      expect(() => testFn()).toThrow("Sync error");
      expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe("withChildSpan", () => {
    it("creates child span for scoped operation", async () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      vi.spyOn(trace, "getTracer").mockReturnValue({
        startSpan: vi.fn().mockReturnValue(mockSpan),
      } as unknown as ReturnType<typeof trace.getTracer>);

      const result = await withChildSpan(
        { name: "child.operation", attributes: { step: "1" } },
        async () => {
          return "child-result";
        },
      );

      expect(result).toBe("child-result");
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe("withChildSpanSync", () => {
    it("creates child span for synchronous scoped operation", () => {
      const mockSpan = {
        end: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
      };

      vi.spyOn(trace, "getTracer").mockReturnValue({
        startSpan: vi.fn().mockReturnValue(mockSpan),
      } as unknown as ReturnType<typeof trace.getTracer>);

      const result = withChildSpanSync({ name: "child.sync" }, () => {
        return 42;
      });

      expect(result).toBe(42);
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe("getCurrentSpan", () => {
    it("returns undefined when no active span", () => {
      vi.spyOn(trace, "getSpan").mockReturnValue(undefined);
      expect(getCurrentSpan()).toBeUndefined();
    });

    it("returns current active span when available", () => {
      const mockSpan = {
        end: vi.fn(),
        setAttribute: vi.fn(),
      } as unknown as Span;

      vi.spyOn(trace, "getSpan").mockReturnValue(mockSpan);
      expect(getCurrentSpan()).toBe(mockSpan);
    });
  });

  describe("addSpanAttribute", () => {
    it("adds attribute to current span when available", () => {
      const mockSpan = {
        setAttribute: vi.fn(),
      } as unknown as Span;

      vi.spyOn(trace, "getSpan").mockReturnValue(mockSpan);

      addSpanAttribute("custom.key", "value");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("custom.key", "value");
    });

    it("does nothing when no active span", () => {
      vi.spyOn(trace, "getSpan").mockReturnValue(undefined);
      // Should not throw
      expect(() => addSpanAttribute("key", "value")).not.toThrow();
    });

    it("filters out invalid attribute values", () => {
      const mockSpan = {
        setAttribute: vi.fn(),
      } as unknown as Span;

      vi.spyOn(trace, "getSpan").mockReturnValue(mockSpan);

      addSpanAttribute("invalid", null);
      addSpanAttribute("also.invalid", undefined);
      addSpanAttribute("valid", "ok");

      expect(mockSpan.setAttribute).toHaveBeenCalledTimes(1);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("valid", "ok");
    });
  });

  describe("addSpanAttributes", () => {
    it("adds multiple attributes to current span", () => {
      const mockSpan = {
        setAttribute: vi.fn(),
      } as unknown as Span;

      vi.spyOn(trace, "getSpan").mockReturnValue(mockSpan);

      addSpanAttributes({
        "dns.domain": "example.com",
        "dns.records_count": 5,
        "dns.cache_hit": true,
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        "dns.domain",
        "example.com",
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        "dns.records_count",
        5,
      );
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("dns.cache_hit", true);
    });

    it("filters out invalid attributes", () => {
      const mockSpan = {
        setAttribute: vi.fn(),
      } as unknown as Span;

      vi.spyOn(trace, "getSpan").mockReturnValue(mockSpan);

      addSpanAttributes({
        valid: "ok",
        invalid: null,
        alsoInvalid: undefined,
        number: 123,
      });

      expect(mockSpan.setAttribute).toHaveBeenCalledTimes(2);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("valid", "ok");
      expect(mockSpan.setAttribute).toHaveBeenCalledWith("number", 123);
    });
  });
});
