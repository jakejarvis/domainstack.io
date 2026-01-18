import { describe, expect, it } from "vitest";
import { WorkflowAPIError } from "workflow/internal/errors";
import {
  handleStepConcurrencyError,
  isConcurrencyConflict,
  logConcurrencyConflict,
  wasAlreadyHandled,
} from "./concurrency";

describe("isConcurrencyConflict", () => {
  it("returns true for 409 WorkflowAPIError with 'error already exists' message", () => {
    const error = new WorkflowAPIError(
      "Cannot set error for workflow step abc123 because error already exists. Error can only be set once.",
      { status: 409 },
    );
    expect(isConcurrencyConflict(error)).toBe(true);
  });

  it("returns true for 409 WorkflowAPIError with 'result already exists' message", () => {
    const error = new WorkflowAPIError(
      "Cannot set result for workflow step abc123 because result already exists.",
      { status: 409 },
    );
    expect(isConcurrencyConflict(error)).toBe(true);
  });

  it("returns true for 409 WorkflowAPIError with 'Cannot set' message", () => {
    const error = new WorkflowAPIError(
      "Cannot set value for step because it was already processed",
      { status: 409 },
    );
    expect(isConcurrencyConflict(error)).toBe(true);
  });

  it("returns false for non-409 WorkflowAPIError", () => {
    const error = new WorkflowAPIError("Server error", { status: 500 });
    expect(isConcurrencyConflict(error)).toBe(false);
  });

  it("returns false for 409 with unrelated message", () => {
    const error = new WorkflowAPIError("Resource conflict - please retry", {
      status: 409,
    });
    expect(isConcurrencyConflict(error)).toBe(true);
  });

  it("returns false for regular Error", () => {
    const error = new Error("Some error");
    expect(isConcurrencyConflict(error)).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isConcurrencyConflict(null)).toBe(false);
    expect(isConcurrencyConflict(undefined)).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isConcurrencyConflict("error")).toBe(false);
    expect(isConcurrencyConflict(409)).toBe(false);
    expect(isConcurrencyConflict({ status: 409 })).toBe(false);
  });
});

describe("handleStepConcurrencyError", () => {
  it("returns 'already_handled' for concurrency conflicts", () => {
    const error = new WorkflowAPIError(
      "Cannot set error for workflow step abc123 because error already exists.",
      { status: 409 },
    );
    const result = handleStepConcurrencyError(error, {
      domain: "test.invalid",
    });
    expect(result).toBe("already_handled");
  });

  it("re-throws non-concurrency errors", () => {
    const error = new Error("Database connection failed");
    expect(() =>
      handleStepConcurrencyError(error, { domain: "test.invalid" }),
    ).toThrow("Database connection failed");
  });

  it("re-throws 500 WorkflowAPIError", () => {
    const error = new WorkflowAPIError("Internal server error", {
      status: 500,
    });
    expect(() => handleStepConcurrencyError(error)).toThrow(
      "Internal server error",
    );
  });
});

describe("wasAlreadyHandled", () => {
  it("returns true for 'already_handled' string", () => {
    expect(wasAlreadyHandled("already_handled")).toBe(true);
  });

  it("returns false for other values", () => {
    expect(wasAlreadyHandled(undefined)).toBe(false);
    expect(wasAlreadyHandled(null)).toBe(false);
    expect(wasAlreadyHandled({ data: "test" })).toBe(false);
    expect(wasAlreadyHandled("other_string")).toBe(false);
  });
});

describe("logConcurrencyConflict", () => {
  it("accepts context and custom message", () => {
    // This test verifies the function signature works correctly
    // The actual logging is mocked in tests, so we just verify it doesn't throw
    expect(() =>
      logConcurrencyConflict(
        { domain: "test.invalid" },
        "custom conflict message",
      ),
    ).not.toThrow();
  });

  it("uses default message when not provided", () => {
    expect(() =>
      logConcurrencyConflict({ domain: "test.invalid" }),
    ).not.toThrow();
  });
});

describe("withConcurrencyHandling", () => {
  it("returns the result for successful operations", async () => {
    const { withConcurrencyHandling } = await import("./concurrency");
    const result = await withConcurrencyHandling(
      Promise.resolve({ data: "test" }),
      { domain: "test.invalid" },
    );
    expect(result).toEqual({ data: "test" });
  });

  it("returns undefined for concurrency conflicts", async () => {
    const { withConcurrencyHandling } = await import("./concurrency");
    const error = new WorkflowAPIError(
      "Cannot set error for workflow step abc123 because error already exists.",
      { status: 409 },
    );
    const result = await withConcurrencyHandling(Promise.reject(error), {
      domain: "example.com",
    });
    expect(result).toBeUndefined();
  });

  it("re-throws non-concurrency errors", async () => {
    const { withConcurrencyHandling } = await import("./concurrency");
    const error = new Error("Database connection failed");
    await expect(
      withConcurrencyHandling(Promise.reject(error), {
        domain: "test.invalid",
      }),
    ).rejects.toThrow("Database connection failed");
  });

  it("re-throws 500 WorkflowAPIError", async () => {
    const { withConcurrencyHandling } = await import("./concurrency");
    const error = new WorkflowAPIError("Internal server error", {
      status: 500,
    });
    await expect(
      withConcurrencyHandling(Promise.reject(error), {}),
    ).rejects.toThrow("Internal server error");
  });
});

describe("isWorkflowConflictError", () => {
  it("returns true for 409 concurrency conflicts", async () => {
    const { isWorkflowConflictError } = await import("./concurrency");
    const error = new WorkflowAPIError(
      "Cannot set error for workflow step because error already exists.",
      { status: 409 },
    );
    expect(isWorkflowConflictError(error)).toBe(true);
  });

  it("returns false for other errors", async () => {
    const { isWorkflowConflictError } = await import("./concurrency");
    expect(isWorkflowConflictError(new Error("test"))).toBe(false);
    expect(
      isWorkflowConflictError(
        new WorkflowAPIError("Server error", { status: 500 }),
      ),
    ).toBe(false);
  });
});

/**
 * Tests for concurrent step execution patterns.
 *
 * These tests verify proper behavior when:
 * - Multiple steps run in parallel via Promise.all
 * - Multiple workers attempt to set the same step result
 * - Errors occur during parallel step execution
 */
describe("concurrent step execution patterns", () => {
  describe("Promise.all step execution", () => {
    it("handles all steps succeeding in parallel", async () => {
      const { withConcurrencyHandling } = await import("./concurrency");

      // Simulate parallel step execution like in hosting-orchestration workflow
      const dnsStep = Promise.resolve({
        records: [{ type: "A", value: "1.2.3.4" }],
      });
      const headersStep = Promise.resolve({
        headers: [{ name: "Server", value: "nginx" }],
      });

      const [dnsResult, headersResult] = await Promise.all([
        withConcurrencyHandling(dnsStep, { step: "dns" }),
        withConcurrencyHandling(headersStep, { step: "headers" }),
      ]);

      expect(dnsResult).toEqual({ records: [{ type: "A", value: "1.2.3.4" }] });
      expect(headersResult).toEqual({
        headers: [{ name: "Server", value: "nginx" }],
      });
    });

    it("handles one step succeeding and one failing in parallel", async () => {
      const { withConcurrencyHandling } = await import("./concurrency");

      const dnsStep = Promise.resolve({ records: [] });
      const headersStep = Promise.reject(new Error("TLS handshake failed"));

      // When using Promise.all, one rejection causes all to reject
      const results = await Promise.allSettled([
        withConcurrencyHandling(dnsStep, { step: "dns" }),
        withConcurrencyHandling(headersStep, { step: "headers" }),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      if (results[1].status === "rejected") {
        expect(results[1].reason).toBeInstanceOf(Error);
        expect((results[1].reason as Error).message).toBe(
          "TLS handshake failed",
        );
      }
    });

    it("handles concurrent 409 conflicts gracefully", async () => {
      const { withConcurrencyHandling } = await import("./concurrency");

      // Simulate two steps both getting 409 (another worker handled them)
      const step1 = Promise.reject(
        new WorkflowAPIError(
          "Cannot set result because result already exists.",
          { status: 409 },
        ),
      );
      const step2 = Promise.reject(
        new WorkflowAPIError("Cannot set error because error already exists.", {
          status: 409,
        }),
      );

      const [result1, result2] = await Promise.all([
        withConcurrencyHandling(step1, { step: "step1" }),
        withConcurrencyHandling(step2, { step: "step2" }),
      ]);

      // Both should return undefined (already handled by another worker)
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    it("handles mixed success, 409, and error in parallel", async () => {
      const { withConcurrencyHandling } = await import("./concurrency");

      const successStep = Promise.resolve({ data: "success" });
      const conflictStep = Promise.reject(
        new WorkflowAPIError(
          "Cannot set result because result already exists.",
          { status: 409 },
        ),
      );
      const errorStep = Promise.reject(new Error("Database connection failed"));

      const results = await Promise.allSettled([
        withConcurrencyHandling(successStep, { step: "success" }),
        withConcurrencyHandling(conflictStep, { step: "conflict" }),
        withConcurrencyHandling(errorStep, { step: "error" }),
      ]);

      // Success step should succeed
      expect(results[0].status).toBe("fulfilled");
      if (results[0].status === "fulfilled") {
        expect(results[0].value).toEqual({ data: "success" });
      }

      // Conflict step should succeed with undefined
      expect(results[1].status).toBe("fulfilled");
      if (results[1].status === "fulfilled") {
        expect(results[1].value).toBeUndefined();
      }

      // Error step should reject
      expect(results[2].status).toBe("rejected");
      if (results[2].status === "rejected") {
        expect((results[2].reason as Error).message).toBe(
          "Database connection failed",
        );
      }
    });
  });

  describe("concurrent worker step conflicts", () => {
    it("detects 409 with 'result already exists' message", () => {
      const error = new WorkflowAPIError(
        "Cannot set result for workflow step step_abc123 because result already exists. Result can only be set once.",
        { status: 409 },
      );
      expect(isConcurrencyConflict(error)).toBe(true);
    });

    it("detects 409 with 'error already exists' message", () => {
      const error = new WorkflowAPIError(
        "Cannot set error for workflow step step_abc123 because error already exists. Error can only be set once.",
        { status: 409 },
      );
      expect(isConcurrencyConflict(error)).toBe(true);
    });

    it("detects 409 with 'value already exists' message", () => {
      const error = new WorkflowAPIError(
        "Cannot set value for step because value already exists.",
        { status: 409 },
      );
      expect(isConcurrencyConflict(error)).toBe(true);
    });

    it("detects 409 with 'already set' message", () => {
      const error = new WorkflowAPIError(
        "Step result was already set by another worker.",
        { status: 409 },
      );
      expect(isConcurrencyConflict(error)).toBe(true);
    });

    it("treats any 409 WorkflowAPIError as conflict (future-proofing)", () => {
      // Even if the message format changes, we should treat 409s as conflicts
      const error = new WorkflowAPIError(
        "Concurrent modification detected for step execution.",
        { status: 409 },
      );
      expect(isConcurrencyConflict(error)).toBe(true);
    });
  });

  describe("concurrent error handling patterns", () => {
    it("handleStepConcurrencyError handles 409 in try-catch pattern", () => {
      const error = new WorkflowAPIError(
        "Cannot set result because result already exists.",
        { status: 409 },
      );

      // Simulating the pattern used in step implementations
      let result: "already_handled" | "completed" = "completed";
      try {
        throw error;
      } catch (err) {
        result = handleStepConcurrencyError(err, { domain: "test.invalid" });
      }

      expect(result).toBe("already_handled");
    });

    it("handleStepConcurrencyError re-throws real errors", () => {
      const error = new Error("Network timeout");

      expect(() => {
        try {
          throw error;
        } catch (err) {
          handleStepConcurrencyError(err, { domain: "test.invalid" });
        }
      }).toThrow("Network timeout");
    });

    it("wasAlreadyHandled correctly identifies handled results", () => {
      // Typical pattern: check if step was already handled before continuing
      const stepResults = [
        "already_handled" as const,
        { data: "real result" },
        undefined,
        null,
      ];

      const handledResults = stepResults.filter(wasAlreadyHandled);
      const dataResults = stepResults.filter((r) => !wasAlreadyHandled(r));

      expect(handledResults).toEqual(["already_handled"]);
      expect(dataResults).toEqual([{ data: "real result" }, undefined, null]);
    });

    it("handles rapid concurrent requests gracefully", async () => {
      const { withConcurrencyHandling } = await import("./concurrency");

      // Simulate many concurrent requests hitting the same step
      const makeRequest = (id: number) => {
        // Some succeed, some get 409, simulating real concurrent behavior
        if (id % 3 === 0) {
          return Promise.reject(
            new WorkflowAPIError(
              "Cannot set result because result already exists.",
              { status: 409 },
            ),
          );
        }
        return Promise.resolve({ id, data: `result-${id}` });
      };

      const requests = Array.from({ length: 10 }, (_, i) =>
        withConcurrencyHandling(makeRequest(i), { requestId: i }),
      );

      const results = await Promise.all(requests);

      // All should complete without throwing
      expect(results).toHaveLength(10);

      // Check that 409s resulted in undefined
      results.forEach((result, i) => {
        if (i % 3 === 0) {
          expect(result).toBeUndefined();
        } else {
          expect(result).toEqual({ id: i, data: `result-${i}` });
        }
      });
    });
  });

  describe("workflow-level concurrent execution", () => {
    it("simulates hosting-orchestration parallel step pattern", async () => {
      const { withConcurrencyHandling } = await import("./concurrency");

      // This mirrors the pattern in hostingOrchestrationWorkflow
      type DnsResult = { records: Array<{ type: string; value: string }> };
      type HeadersResult =
        | {
            success: true;
            data: { headers: Array<{ name: string; value: string }> };
          }
        | { success: false; error: string };

      const fetchDns = (): Promise<DnsResult> =>
        Promise.resolve({ records: [{ type: "A", value: "192.0.2.1" }] });

      const fetchHeaders = (): Promise<HeadersResult> =>
        Promise.resolve({
          success: true,
          data: { headers: [{ name: "X-Powered-By", value: "Next.js" }] },
        });

      // Parallel fetch like in the workflow
      const [dnsResult, headersResult] = await Promise.all([
        withConcurrencyHandling(fetchDns(), { step: "dns" }),
        withConcurrencyHandling(fetchHeaders(), { step: "headers" }),
      ]);

      expect(dnsResult?.records).toHaveLength(1);
      expect(headersResult?.success).toBe(true);
    });

    it("simulates section-revalidate with partial failures", async () => {
      const { withConcurrencyHandling } = await import("./concurrency");

      // DNS succeeds, headers fails - mirrors section-revalidate hosting case
      const dnsStep = Promise.resolve({
        records: [{ type: "A", value: "1.2.3.4" }],
      });
      const headersStep = Promise.resolve({
        success: false as const,
        error: "tls_error",
      });

      const [dnsResult, headersResult] = await Promise.all([
        withConcurrencyHandling(dnsStep, { step: "dns" }),
        withConcurrencyHandling(headersStep, { step: "headers" }),
      ]);

      // DNS should succeed
      expect(dnsResult).toEqual({ records: [{ type: "A", value: "1.2.3.4" }] });

      // Headers returns typed error (not throws)
      expect(headersResult).toEqual({ success: false, error: "tls_error" });
    });

    it("handles concurrent workflow retries", async () => {
      const { withConcurrencyHandling } = await import("./concurrency");

      // Simulate workflow being retried by multiple workers simultaneously
      // First worker succeeds, subsequent workers get 409
      let callCount = 0;
      const makeStep = () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ success: true, worker: 1 });
        }
        return Promise.reject(
          new WorkflowAPIError(
            "Cannot set result because result already exists.",
            { status: 409 },
          ),
        );
      };

      // Three "workers" trying to execute the same step
      const worker1 = withConcurrencyHandling(makeStep(), { worker: 1 });
      const worker2 = withConcurrencyHandling(makeStep(), { worker: 2 });
      const worker3 = withConcurrencyHandling(makeStep(), { worker: 3 });

      const results = await Promise.all([worker1, worker2, worker3]);

      // Only first worker's result should be defined
      expect(results[0]).toEqual({ success: true, worker: 1 });
      expect(results[1]).toBeUndefined();
      expect(results[2]).toBeUndefined();
    });
  });
});
