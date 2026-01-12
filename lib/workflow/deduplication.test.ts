import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAllPendingRuns,
  getDeduplicationKey,
  getPendingRunCount,
  hasPendingRun,
  startWithDeduplication,
} from "./deduplication";

describe("getDeduplicationKey", () => {
  it("generates consistent keys for same input", () => {
    const key1 = getDeduplicationKey("registration", { domain: "example.com" });
    const key2 = getDeduplicationKey("registration", { domain: "example.com" });
    expect(key1).toBe(key2);
  });

  it("generates different keys for different workflows", () => {
    const key1 = getDeduplicationKey("registration", { domain: "example.com" });
    const key2 = getDeduplicationKey("dns", { domain: "example.com" });
    expect(key1).not.toBe(key2);
  });

  it("generates different keys for different inputs", () => {
    const key1 = getDeduplicationKey("registration", { domain: "example.com" });
    const key2 = getDeduplicationKey("registration", { domain: "other.com" });
    expect(key1).not.toBe(key2);
  });

  it("handles complex inputs", () => {
    const key = getDeduplicationKey("hosting", {
      domain: "example.com",
      dnsRecords: [{ type: "A", value: "1.2.3.4" }],
    });
    expect(key).toContain("hosting:");
    expect(key).toContain("example.com");
  });

  it("generates same key for objects with different property ordering", () => {
    const key1 = getDeduplicationKey("hosting", {
      domain: "example.com",
      headers: ["X-Frame-Options"],
      dnsRecords: [{ type: "A", value: "1.2.3.4" }],
    });
    const key2 = getDeduplicationKey("hosting", {
      dnsRecords: [{ type: "A", value: "1.2.3.4" }],
      domain: "example.com",
      headers: ["X-Frame-Options"],
    });
    expect(key1).toBe(key2);
  });

  it("generates same key for nested objects with different property ordering", () => {
    const key1 = getDeduplicationKey("test", {
      outer: { a: 1, b: 2 },
      list: [{ x: 10, y: 20 }],
    });
    const key2 = getDeduplicationKey("test", {
      list: [{ y: 20, x: 10 }],
      outer: { b: 2, a: 1 },
    });
    expect(key1).toBe(key2);
  });

  it("preserves array order (arrays are not sorted)", () => {
    const key1 = getDeduplicationKey("test", { items: ["a", "b", "c"] });
    const key2 = getDeduplicationKey("test", { items: ["c", "b", "a"] });
    expect(key1).not.toBe(key2);
  });

  it("handles null values", () => {
    const key1 = getDeduplicationKey("test", { value: null });
    const key2 = getDeduplicationKey("test", { value: null });
    expect(key1).toBe(key2);
  });

  it("handles primitive inputs", () => {
    expect(getDeduplicationKey("test", "string")).toBe(
      getDeduplicationKey("test", "string"),
    );
    expect(getDeduplicationKey("test", 123)).toBe(
      getDeduplicationKey("test", 123),
    );
    expect(getDeduplicationKey("test", true)).toBe(
      getDeduplicationKey("test", true),
    );
  });

  it("generates different keys for different Date values", () => {
    const key1 = getDeduplicationKey("test", {
      expiresAt: new Date("2024-01-01"),
    });
    const key2 = getDeduplicationKey("test", {
      expiresAt: new Date("2025-12-31"),
    });
    expect(key1).not.toBe(key2);
  });

  it("generates same key for same Date values", () => {
    const key1 = getDeduplicationKey("test", {
      expiresAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    const key2 = getDeduplicationKey("test", {
      expiresAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    expect(key1).toBe(key2);
  });

  it("handles Date values with different property ordering", () => {
    const key1 = getDeduplicationKey("test", {
      domain: "example.com",
      expiresAt: new Date("2024-01-01"),
    });
    const key2 = getDeduplicationKey("test", {
      expiresAt: new Date("2024-01-01"),
      domain: "example.com",
    });
    expect(key1).toBe(key2);
  });
});

describe("startWithDeduplication", () => {
  afterEach(() => {
    clearAllPendingRuns();
  });

  it("executes the workflow function", async () => {
    const workflowFn = vi.fn().mockResolvedValue({ success: true });
    const key = getDeduplicationKey("test1", { id: 1 });

    const result = await startWithDeduplication(key, workflowFn);

    expect(workflowFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });

  it("deduplicates concurrent requests with same key", async () => {
    let resolveWorkflow: ((value: unknown) => void) | undefined;
    const workflowPromise = new Promise((resolve) => {
      resolveWorkflow = resolve;
    });
    const workflowFn = vi.fn().mockReturnValue(workflowPromise);
    const key = getDeduplicationKey("test2", { id: 2 });

    // Start two concurrent requests
    const promise1 = startWithDeduplication(key, workflowFn);
    const promise2 = startWithDeduplication(key, workflowFn);

    // Workflow start is scheduled in a microtask; flush it before asserting.
    await Promise.resolve();

    // Only one workflow should be started
    expect(workflowFn).toHaveBeenCalledTimes(1);

    // Both should be waiting for the same result
    expect(hasPendingRun(key)).toBe(true);

    // Resolve the workflow
    if (resolveWorkflow) {
      resolveWorkflow({ data: "shared" });
    }

    // Both promises should resolve with the same result
    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).toEqual({ data: "shared" });
    expect(result2).toEqual({ data: "shared" });

    // Pending run should be cleaned up
    expect(hasPendingRun(key)).toBe(false);
  });

  it("allows new runs after previous completes", async () => {
    const workflowFn = vi.fn().mockResolvedValue({ run: 1 });
    const key = getDeduplicationKey("test3", { id: 3 });

    // First run
    await startWithDeduplication(key, workflowFn);
    expect(workflowFn).toHaveBeenCalledTimes(1);

    // Second run (after first completes)
    workflowFn.mockResolvedValue({ run: 2 });
    const result = await startWithDeduplication(key, workflowFn);

    expect(workflowFn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ run: 2 });
  });

  it("cleans up on error", async () => {
    const workflowFn = vi.fn().mockRejectedValue(new Error("workflow failed"));
    const key = getDeduplicationKey("test4", { id: 4 });

    await expect(startWithDeduplication(key, workflowFn)).rejects.toThrow(
      "workflow failed",
    );

    // Pending run should be cleaned up even on error
    expect(hasPendingRun(key)).toBe(false);
  });

  it("propagates errors to all waiters", async () => {
    let rejectWorkflow: ((error: Error) => void) | undefined;
    const workflowPromise = new Promise((_, reject) => {
      rejectWorkflow = reject;
    });
    const workflowFn = vi.fn().mockReturnValue(workflowPromise);
    const key = getDeduplicationKey("test5", { id: 5 });

    // Start two concurrent requests
    const promise1 = startWithDeduplication(key, workflowFn);
    const promise2 = startWithDeduplication(key, workflowFn);

    // Reject the workflow
    if (rejectWorkflow) {
      rejectWorkflow(new Error("shared error"));
    }

    // Both should reject with the same error
    await expect(promise1).rejects.toThrow("shared error");
    await expect(promise2).rejects.toThrow("shared error");
  });

  it("deduplicates and cleans up when startWorkflow throws synchronously", async () => {
    const workflowFn = vi.fn(() => {
      throw new Error("sync boom");
    });
    const key = getDeduplicationKey("test-sync-throw", { id: 6 });

    const promise1 = startWithDeduplication(key, workflowFn as never);
    const promise2 = startWithDeduplication(key, workflowFn as never);

    expect(workflowFn).toHaveBeenCalledTimes(0); // called in a microtask

    await expect(promise1).rejects.toThrow("sync boom");
    await expect(promise2).rejects.toThrow("sync boom");

    // Only one run should have been attempted, and state should be cleaned up
    expect(workflowFn).toHaveBeenCalledTimes(1);
    expect(hasPendingRun(key)).toBe(false);
  });

  it("can keep a key pending until a keepAlive promise settles (attach while workflow is running)", async () => {
    let resolveReturnValue: ((value: unknown) => void) | undefined;
    const returnValue = new Promise((resolve) => {
      resolveReturnValue = resolve;
    });

    type KeepAliveResult = {
      runId: string;
      returnValue: Promise<unknown>;
    };

    const workflowFn = vi
      .fn<() => Promise<KeepAliveResult>>()
      .mockResolvedValue({
        runId: "run_123",
        returnValue,
      });

    const key = getDeduplicationKey("test-keep-alive", { id: 7 });

    // First call resolves quickly (it returns the runId), but should remain pending due to keepAliveUntil.
    const result1 = await startWithDeduplication<KeepAliveResult>(
      key,
      workflowFn,
      {
        keepAliveUntil: (r) => r.returnValue,
      },
    );
    expect(result1.runId).toBe("run_123");
    expect(workflowFn).toHaveBeenCalledTimes(1);
    expect(hasPendingRun(key)).toBe(true);

    // A subsequent call should attach and not start a second workflow.
    const result2 = await startWithDeduplication<KeepAliveResult>(
      key,
      workflowFn,
      {
        keepAliveUntil: (r) => r.returnValue,
      },
    );
    expect(result2.runId).toBe("run_123");
    expect(workflowFn).toHaveBeenCalledTimes(1);

    // Resolve the underlying workflow.
    resolveReturnValue?.({ ok: true });
    await returnValue;

    // Cleanup happens after keepAlive settles.
    for (let i = 0; i < 10 && hasPendingRun(key); i++) {
      await Promise.resolve();
    }
    expect(hasPendingRun(key)).toBe(false);
  });
});

describe("getPendingRunCount", () => {
  afterEach(() => {
    clearAllPendingRuns();
  });

  it("returns 0 when no runs are pending", () => {
    expect(getPendingRunCount()).toBe(0);
  });
});
