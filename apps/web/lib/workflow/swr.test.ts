import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withSwrCache } from "./swr";

// Mock the deduplication module
vi.mock("./deduplication", () => ({
  getDeduplicationKey: vi.fn(
    (workflow: string, domain: string) => `${workflow}:${domain}`,
  ),
  startWithDeduplication: vi.fn(),
}));

// Get the mocked functions
const { getDeduplicationKey, startWithDeduplication } = await import(
  "./deduplication"
);

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
      expect(startWithDeduplication).not.toHaveBeenCalled();
    });
  });

  describe("stale data (background revalidation)", () => {
    it("returns stale data immediately and triggers background revalidation", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: { id: 1, name: "stale" },
        stale: true,
        expiresAt: new Date(Date.now() - 1000),
      });

      const workflowResult = { success: true, data: { id: 1, name: "fresh" } };
      const startWorkflow = vi.fn().mockResolvedValue({
        returnValue: Promise.resolve(workflowResult),
      });

      // Mock startWithDeduplication to just run the function
      vi.mocked(startWithDeduplication).mockImplementation(async (_key, fn) =>
        fn(),
      );

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

      // Background revalidation should be triggered
      expect(startWithDeduplication).toHaveBeenCalledTimes(1);
      expect(getDeduplicationKey).toHaveBeenCalledWith("test", "test.invalid");

      // Wait for background work to complete
      await vi.waitFor(() => {
        expect(startWorkflow).toHaveBeenCalledTimes(1);
      });
    });

    it("passes maxPendingMs safety valve to startWithDeduplication", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: { id: 1 },
        stale: true,
        expiresAt: new Date(Date.now() - 1000),
      });

      const startWorkflow = vi.fn().mockResolvedValue({
        returnValue: Promise.resolve({ success: true, data: { id: 1 } }),
      });

      vi.mocked(startWithDeduplication).mockImplementation(async (_key, fn) =>
        fn(),
      );

      await withSwrCache({
        workflowName: "test",
        domain: "test.invalid",
        getCached,
        startWorkflow,
      });

      // Check that maxPendingMs was passed (5 minutes = 300000ms)
      expect(startWithDeduplication).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        { maxPendingMs: 5 * 60 * 1000 },
      );
    });

    it("logs and tracks errors from background revalidation", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: { id: 1 },
        stale: true,
        expiresAt: new Date(Date.now() - 1000),
      });

      const startWorkflow = vi.fn();
      const testError = new Error("Background workflow failed");

      // Mock startWithDeduplication to reject
      vi.mocked(startWithDeduplication).mockRejectedValue(testError);

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
      // The rejection is caught and logged internally - we verify no unhandled rejection
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe("cache miss (workflow execution)", () => {
    it("runs workflow and waits for result when no cached data", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: null,
        stale: false,
        expiresAt: null,
      });

      const workflowResult = { success: true, data: { id: 2, name: "new" } };
      const startWorkflow = vi.fn().mockResolvedValue({
        returnValue: Promise.resolve(workflowResult),
      });

      vi.mocked(startWithDeduplication).mockImplementation(async (_key, fn) =>
        fn(),
      );

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
      expect(startWithDeduplication).toHaveBeenCalledTimes(1);
      expect(startWorkflow).toHaveBeenCalledTimes(1);
    });

    it("returns error when workflow fails", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: null,
        stale: false,
        expiresAt: null,
      });

      const workflowResult = {
        success: false,
        data: null,
        error: "RDAP lookup failed",
      };
      const startWorkflow = vi.fn().mockResolvedValue({
        returnValue: Promise.resolve(workflowResult),
      });

      vi.mocked(startWithDeduplication).mockImplementation(async (_key, fn) =>
        fn(),
      );

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
        expiresAt: null,
      });

      const workflowResult = { success: false, data: null };
      const startWorkflow = vi.fn().mockResolvedValue({
        returnValue: Promise.resolve(workflowResult),
      });

      vi.mocked(startWithDeduplication).mockImplementation(async (_key, fn) =>
        fn(),
      );

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

  describe("deduplication key generation", () => {
    it("generates correct deduplication key", async () => {
      const getCached = vi.fn().mockResolvedValue({
        data: null,
        stale: false,
        expiresAt: null,
      });

      const startWorkflow = vi.fn().mockResolvedValue({
        returnValue: Promise.resolve({ success: true, data: {} }),
      });

      vi.mocked(startWithDeduplication).mockImplementation(async (_key, fn) =>
        fn(),
      );

      await withSwrCache({
        workflowName: "registration",
        domain: "another.invalid",
        getCached,
        startWorkflow,
      });

      expect(getDeduplicationKey).toHaveBeenCalledWith(
        "registration",
        "another.invalid",
      );
    });
  });
});
