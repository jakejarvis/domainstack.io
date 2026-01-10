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
});

describe("getPendingRunCount", () => {
  afterEach(() => {
    clearAllPendingRuns();
  });

  it("returns 0 when no runs are pending", () => {
    expect(getPendingRunCount()).toBe(0);
  });
});
