/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the workflow module
const workflowMock = vi.hoisted(() => ({
  start: vi.fn(),
}));

vi.mock("workflow/api", () => workflowMock);

// Mock the workflow function
vi.mock("@/workflows/screenshot/workflow", () => ({
  screenshotWorkflow: vi.fn(),
}));

import { getScreenshot } from "./screenshot";

describe("getScreenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns cached url from workflow result", async () => {
    workflowMock.start.mockResolvedValueOnce({
      runId: "test-run-1",
      returnValue: Promise.resolve({
        url: "https://blob.vercel-storage.com/cached.webp",
        blocked: false,
        cached: true,
      }),
    });

    const result = await getScreenshot("example.com");

    expect(result.url).toBe("https://blob.vercel-storage.com/cached.webp");
    expect(result.blocked).toBeUndefined();
    expect(workflowMock.start).toHaveBeenCalledTimes(1);
  });

  it("returns url from freshly generated screenshot", async () => {
    workflowMock.start.mockResolvedValueOnce({
      runId: "test-run-2",
      returnValue: Promise.resolve({
        url: "https://blob.vercel-storage.com/fresh.webp",
        blocked: false,
        cached: false,
      }),
    });

    const result = await getScreenshot("example.com");

    expect(result.url).toBe("https://blob.vercel-storage.com/fresh.webp");
    expect(result.blocked).toBeUndefined();
  });

  it("returns blocked: true when domain is on blocklist", async () => {
    workflowMock.start.mockResolvedValueOnce({
      runId: "test-run-3",
      returnValue: Promise.resolve({
        url: null,
        blocked: true,
        cached: false,
      }),
    });

    const result = await getScreenshot("blocked-domain.com");

    expect(result.url).toBeNull();
    expect(result.blocked).toBe(true);
  });

  it("returns null url when workflow fails", async () => {
    workflowMock.start.mockResolvedValueOnce({
      runId: "test-run-4",
      returnValue: Promise.resolve({
        url: null,
        blocked: false,
        cached: false,
      }),
    });

    const result = await getScreenshot("failed-domain.com");

    expect(result.url).toBeNull();
    expect(result.blocked).toBeUndefined();
  });

  it("returns null url when workflow throws", async () => {
    workflowMock.start.mockRejectedValueOnce(new Error("Workflow failed"));

    const result = await getScreenshot("error-domain.com");

    expect(result.url).toBeNull();
    expect(result.blocked).toBeUndefined();
  });

  it("deduplicates concurrent requests for the same domain", async () => {
    // Create a promise that we can control
    // Using definite assignment assertion since Promise executor runs synchronously
    let resolveWorkflow!: (value: unknown) => void;
    const workflowPromise = new Promise((resolve) => {
      resolveWorkflow = resolve;
    });

    workflowMock.start.mockReturnValue({
      runId: "test-run-5",
      returnValue: workflowPromise,
    });

    // Start two concurrent requests
    const promise1 = getScreenshot("concurrent.com");
    const promise2 = getScreenshot("concurrent.com");

    // Only one workflow should have started
    expect(workflowMock.start).toHaveBeenCalledTimes(1);

    // Resolve the workflow
    resolveWorkflow({
      url: "https://blob.vercel-storage.com/concurrent.webp",
      blocked: false,
      cached: false,
    });

    // Both promises should resolve to the same result
    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1.url).toBe("https://blob.vercel-storage.com/concurrent.webp");
    expect(result2.url).toBe("https://blob.vercel-storage.com/concurrent.webp");
  });
});
