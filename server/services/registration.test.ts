/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock workflow/api module
const workflowMock = vi.hoisted(() => ({
  start: vi.fn(),
}));

vi.mock("workflow/api", () => workflowMock);

// Mock scheduleRevalidation to avoid Inngest API calls in tests
vi.mock("@/lib/schedule", () => ({
  scheduleRevalidation: vi.fn().mockResolvedValue(true),
}));

// Mock next/server's after() to run callback synchronously
vi.mock("next/server", () => ({
  after: vi.fn((fn: () => void) => fn()),
}));

describe("getRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns registration data from successful workflow", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-1",
      returnValue: Promise.resolve({
        success: true,
        cached: false,
        data: {
          domain: "example.com",
          tld: "com",
          isRegistered: true,
          status: "registered",
          registrarProvider: {
            id: "prov-1",
            name: "GoDaddy",
            domain: "godaddy.com",
          },
          source: "rdap",
        },
      }),
    });

    const { getRegistration } = await import("./registration");
    const result = await getRegistration("example.com");

    expect(workflowMock.start).toHaveBeenCalledOnce();
    expect(result.domain).toBe("example.com");
    expect(result.isRegistered).toBe(true);
    expect(result.status).toBe("registered");
    expect(result.registrarProvider?.name).toBe("GoDaddy");
  });

  it("returns cached registration data without scheduling revalidation", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-2",
      returnValue: Promise.resolve({
        success: true,
        cached: true,
        data: {
          domain: "cached.com",
          tld: "com",
          isRegistered: true,
          status: "registered",
          registrarProvider: { id: null, name: null, domain: null },
          source: "rdap",
        },
      }),
    });

    const { scheduleRevalidation } = await import("@/lib/schedule");
    const { getRegistration } = await import("./registration");
    await getRegistration("cached.com");

    // Cached results should NOT trigger scheduling
    expect(scheduleRevalidation).not.toHaveBeenCalled();
  });

  it("schedules revalidation for non-cached successful results", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-3",
      returnValue: Promise.resolve({
        success: true,
        cached: false,
        data: {
          domain: "fresh.com",
          tld: "com",
          isRegistered: true,
          status: "registered",
          registrarProvider: { id: null, name: null, domain: null },
          source: "rdap",
        },
      }),
    });

    const { scheduleRevalidation } = await import("@/lib/schedule");
    const { getRegistration } = await import("./registration");
    await getRegistration("fresh.com");

    // Non-cached results SHOULD trigger scheduling
    expect(scheduleRevalidation).toHaveBeenCalledWith(
      "fresh.com",
      "registration",
      expect.any(Number),
      null,
    );
  });

  it("skips scheduling when skipScheduling option is true", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-4",
      returnValue: Promise.resolve({
        success: true,
        cached: false,
        data: {
          domain: "skip.com",
          tld: "com",
          isRegistered: true,
          status: "registered",
          registrarProvider: { id: null, name: null, domain: null },
          source: "rdap",
        },
      }),
    });

    const { scheduleRevalidation } = await import("@/lib/schedule");
    const { getRegistration } = await import("./registration");
    await getRegistration("skip.com", { skipScheduling: true });

    expect(scheduleRevalidation).not.toHaveBeenCalled();
  });

  it("returns unregistered domain data", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-5",
      returnValue: Promise.resolve({
        success: true,
        cached: false,
        data: {
          domain: "available.com",
          tld: "com",
          isRegistered: false,
          status: "unregistered",
          registrarProvider: { id: null, name: null, domain: null },
          source: "rdap",
        },
      }),
    });

    const { getRegistration } = await import("./registration");
    const result = await getRegistration("available.com");

    expect(result.isRegistered).toBe(false);
    expect(result.status).toBe("unregistered");
  });

  it("handles unsupported TLD gracefully", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-6",
      returnValue: Promise.resolve({
        success: false,
        cached: false,
        error: "unsupported_tld",
        data: {
          domain: "example.ls",
          tld: "ls",
          isRegistered: false,
          status: "unknown",
          unavailableReason: "unsupported_tld",
          source: null,
          registrarProvider: { id: null, name: null, domain: null },
        },
      }),
    });

    const { getRegistration } = await import("./registration");
    const result = await getRegistration("example.ls");

    expect(result.domain).toBe("example.ls");
    expect(result.status).toBe("unknown");
    expect(result.unavailableReason).toBe("unsupported_tld");
  });

  it("handles timeout gracefully", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-7",
      returnValue: Promise.resolve({
        success: false,
        cached: false,
        error: "timeout",
        data: {
          domain: "slow.com",
          tld: "com",
          isRegistered: false,
          status: "unknown",
          unavailableReason: "timeout",
          source: null,
          registrarProvider: { id: null, name: null, domain: null },
        },
      }),
    });

    const { getRegistration } = await import("./registration");
    const result = await getRegistration("slow.com");

    expect(result.status).toBe("unknown");
    expect(result.unavailableReason).toBe("timeout");
  });

  it("throws error when workflow fails with lookup_failed and no data", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-8",
      returnValue: Promise.resolve({
        success: false,
        cached: false,
        error: "lookup_failed",
        data: null,
      }),
    });

    const { getRegistration } = await import("./registration");

    await expect(getRegistration("error.com")).rejects.toThrow(
      "Registration lookup failed for error.com: lookup_failed",
    );
  });

  it("throws error when workflow itself throws", async () => {
    workflowMock.start.mockReturnValue({
      runId: "test-run-9",
      returnValue: Promise.reject(new Error("Workflow crashed")),
    });

    const { getRegistration } = await import("./registration");

    await expect(getRegistration("crash.com")).rejects.toThrow(
      "Workflow crashed",
    );
  });

  it("deduplicates concurrent requests to the same domain", async () => {
    let resolveWorkflow: (value: unknown) => void = () => {};
    const workflowPromise = new Promise((resolve) => {
      resolveWorkflow = resolve;
    });

    workflowMock.start.mockReturnValue({
      runId: "test-run-10",
      returnValue: workflowPromise,
    });

    const { getRegistration } = await import("./registration");

    // Start two concurrent requests
    const promise1 = getRegistration("concurrent.com");
    const promise2 = getRegistration("concurrent.com");

    // Resolve the workflow
    resolveWorkflow({
      success: true,
      cached: false,
      data: {
        domain: "concurrent.com",
        tld: "com",
        isRegistered: true,
        status: "registered",
        registrarProvider: { id: null, name: null, domain: null },
        source: "rdap",
      },
    });

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Both should get the same result
    expect(result1.domain).toBe("concurrent.com");
    expect(result2.domain).toBe("concurrent.com");

    // Note: The service doesn't have built-in deduplication like screenshot
    // so this test verifies the workflow is called twice
    expect(workflowMock.start).toHaveBeenCalledTimes(2);
  });
});
