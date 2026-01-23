import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withSwrCache } from "./swr";

describe("withSwrCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("fresh data (cache hit)", () => {
    it("returns fresh data immediately without triggering workflow", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: { id: 1, name: "test" },
        stale: false,
        fetchedAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 3600000),
      });
      const startWorkflow = vi.fn();

      const result = await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
      });

      expect(result).toEqual({
        success: true,
        cached: true,
        stale: false,
        data: { id: 1, name: "test" },
      });
      expect(getCached).toHaveBeenCalledTimes(1);
      expect(startWorkflow).not.toHaveBeenCalled();
    });
  });

  describe("stale data (background revalidation)", () => {
    it("returns stale data immediately and triggers background revalidation", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: { id: 1, name: "stale" },
        stale: true,
        fetchedAt: new Date(Date.now() - 60000), // 1 minute ago
        expiresAt: new Date(Date.now() - 1000),
      });

      const workflowResult = { success: true, data: { id: 1, name: "fresh" } };
      const startWorkflow = vi.fn().mockResolvedValue({
        runId: "run_123",
        returnValue: Promise.resolve(workflowResult),
      });

      const result = await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
      });

      // Should return stale data immediately
      expect(result).toEqual({
        success: true,
        cached: true,
        stale: true,
        data: { id: 1, name: "stale" },
      });

      // Background revalidation should be triggered (fire and forget)
      await vi.waitFor(() => {
        expect(startWorkflow).toHaveBeenCalledTimes(1);
      });
    });

    it("logs errors from background revalidation without affecting response", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: { id: 1 },
        stale: true,
        fetchedAt: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() - 1000),
      });

      const testError = new Error("Background workflow failed");
      const startWorkflow = vi.fn().mockRejectedValue(testError);

      const result = await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
      });

      // Should still return stale data
      expect(result).toEqual({
        success: true,
        cached: true,
        stale: true,
        data: { id: 1 },
      });

      // Wait for the rejected promise to be handled
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("waits for fresh data when stale data exceeds maxAgeMs", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: { id: 1, name: "very stale" },
        stale: true,
        fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        expiresAt: new Date(Date.now() - 1000),
      });

      const workflowResult = { success: true, data: { id: 2, name: "fresh" } };
      const startWorkflow = vi.fn().mockResolvedValue({
        runId: "run_123",
        returnValue: Promise.resolve(workflowResult),
      });

      const result = await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
        maxAgeMs: 60 * 60 * 1000, // 1 hour max
      });

      // Should wait for fresh data, not return stale
      expect(result).toEqual({
        success: true,
        cached: false,
        stale: false,
        data: { id: 2, name: "fresh" },
      });
      expect(startWorkflow).toHaveBeenCalledTimes(1);
    });

    it("returns stale data when within maxAgeMs", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: { id: 1, name: "stale" },
        stale: true,
        fetchedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        expiresAt: new Date(Date.now() - 1000),
      });

      const workflowResult = { success: true, data: { id: 2, name: "fresh" } };
      const startWorkflow = vi.fn().mockResolvedValue({
        runId: "run_123",
        returnValue: Promise.resolve(workflowResult),
      });

      const result = await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
        maxAgeMs: 60 * 60 * 1000, // 1 hour max
      });

      // Should return stale data since it's within maxAgeMs
      expect(result).toEqual({
        success: true,
        cached: true,
        stale: true,
        data: { id: 1, name: "stale" },
      });

      // Background revalidation should still be triggered
      await vi.waitFor(() => {
        expect(startWorkflow).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("cache miss (workflow execution)", () => {
    it("runs workflow and waits for result when no cached data", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: null,
        stale: false,
        fetchedAt: null,
        expiresAt: null,
      });

      const workflowResult = { success: true, data: { id: 2, name: "new" } };
      const startWorkflow = vi.fn().mockResolvedValue({
        runId: "run_123",
        returnValue: Promise.resolve(workflowResult),
      });

      const result = await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
      });

      expect(result).toEqual({
        success: true,
        cached: false,
        stale: false,
        data: { id: 2, name: "new" },
      });
      expect(startWorkflow).toHaveBeenCalledTimes(1);
    });

    it("returns error when workflow fails", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: null,
        stale: false,
        fetchedAt: null,
        expiresAt: null,
      });

      const workflowResult = {
        success: false,
        data: null,
        error: "RDAP lookup failed",
      };
      const startWorkflow = vi.fn().mockResolvedValue({
        runId: "run_456",
        returnValue: Promise.resolve(workflowResult),
      });

      const result = await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
      });

      expect(result).toEqual({
        success: false,
        error: "RDAP lookup failed",
        data: null,
      });
    });

    it("returns generic error when workflow fails without error message", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: null,
        stale: false,
        fetchedAt: null,
        expiresAt: null,
      });

      const workflowResult = { success: false, data: null };
      const startWorkflow = vi.fn().mockResolvedValue({
        runId: "run_789",
        returnValue: Promise.resolve(workflowResult),
      });

      const result = await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
      });

      expect(result).toEqual({
        success: false,
        error: "Workflow failed",
        data: null,
      });
    });
  });
});
