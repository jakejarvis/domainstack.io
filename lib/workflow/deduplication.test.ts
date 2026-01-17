import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// Mock workflow/api
const mockGetRun = vi.fn();
vi.mock("workflow/api", () => ({
  getRun: (...args: unknown[]) => mockGetRun(...args),
}));

// Import after mocks are set up
const {
  clearAllPendingRuns,
  getDeduplicationKey,
  getOrStartWorkflow,
  getPendingRunCount,
  hasPendingRun,
  startWithDeduplication,
} = await import("./deduplication");

describe("getDeduplicationKey", () => {
  it("generates consistent keys for same input", () => {
    const key1 = getDeduplicationKey("registration", {
      domain: "test.invalid",
    });
    const key2 = getDeduplicationKey("registration", {
      domain: "test.invalid",
    });
    expect(key1).toBe(key2);
  });

  it("generates different keys for different workflows", () => {
    const key1 = getDeduplicationKey("registration", {
      domain: "test.invalid",
    });
    const key2 = getDeduplicationKey("dns", { domain: "test.invalid" });
    expect(key1).not.toBe(key2);
  });

  it("generates different keys for different inputs", () => {
    const key1 = getDeduplicationKey("registration", {
      domain: "test.invalid",
    });
    const key2 = getDeduplicationKey("registration", {
      domain: "other.invalid",
    });
    expect(key1).not.toBe(key2);
  });

  it("handles complex inputs", () => {
    const key = getDeduplicationKey("hosting", {
      domain: "test.invalid",
      dnsRecords: [{ type: "A", value: "1.2.3.4" }],
    });
    expect(key).toContain("hosting:");
    expect(key).toContain("test.invalid");
  });

  it("generates same key for objects with different property ordering", () => {
    const key1 = getDeduplicationKey("hosting", {
      domain: "test.invalid",
      headers: ["X-Frame-Options"],
      dnsRecords: [{ type: "A", value: "1.2.3.4" }],
    });
    const key2 = getDeduplicationKey("hosting", {
      dnsRecords: [{ type: "A", value: "1.2.3.4" }],
      domain: "test.invalid",
      headers: ["X-Frame-Options"],
    });
    expect(key1).toBe(key2);
  });

  it("handles primitive inputs", () => {
    expect(getDeduplicationKey("test", "string")).toBe(
      getDeduplicationKey("test", "string"),
    );
    expect(getDeduplicationKey("test", 123)).toBe(
      getDeduplicationKey("test", 123),
    );
  });

  it("handles Date values", () => {
    const key1 = getDeduplicationKey("test", {
      expiresAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    const key2 = getDeduplicationKey("test", {
      expiresAt: new Date("2024-01-01T00:00:00.000Z"),
    });
    expect(key1).toBe(key2);
  });
});

describe("startWithDeduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllPendingRuns();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.del.mockResolvedValue(1);
  });

  afterEach(() => {
    clearAllPendingRuns();
  });

  it("starts a new workflow and returns result with metadata", async () => {
    const mockRun = {
      runId: "run_new_123",
      returnValue: Promise.resolve({ success: true, data: "result" }),
    };
    const startWorkflow = vi.fn().mockResolvedValue(mockRun);

    const key = getDeduplicationKey("test", "example.com");
    const { result, deduplicated, source } = await startWithDeduplication(
      key,
      startWorkflow,
    );

    expect(startWorkflow).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, data: "result" });
    expect(deduplicated).toBe(false);
    expect(source).toBe("new");

    // Should store run ID in Redis
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining("workflow:run:test:"),
      "run_new_123",
      { nx: true, ex: 300 },
    );
  });

  it("subscribes to existing run found in Redis", async () => {
    const existingRunId = "run_existing_456";
    mockRedis.get.mockResolvedValue(existingRunId);

    const mockExistingRun = {
      status: Promise.resolve("running"),
      returnValue: Promise.resolve({ success: true, data: "shared" }),
    };
    mockGetRun.mockReturnValue(mockExistingRun);

    const startWorkflow = vi.fn();
    const key = getDeduplicationKey("test", "example.com");

    const { result, deduplicated, source } = await startWithDeduplication(
      key,
      startWorkflow,
    );

    expect(startWorkflow).not.toHaveBeenCalled();
    expect(mockGetRun).toHaveBeenCalledWith(existingRunId);
    expect(result).toEqual({ success: true, data: "shared" });
    expect(deduplicated).toBe(true);
    expect(source).toBe("redis");
  });

  it("starts new workflow when existing run has failed status", async () => {
    const existingRunId = "run_failed_abc";
    mockRedis.get.mockResolvedValue(existingRunId);

    // Create a rejected promise but catch it to avoid unhandled rejection
    const rejectedPromise = Promise.reject(new Error("previous failure"));
    rejectedPromise.catch(() => {});

    const mockExistingRun = {
      status: Promise.resolve("failed"),
      returnValue: rejectedPromise,
    };
    mockGetRun.mockReturnValue(mockExistingRun);

    const mockNewRun = {
      runId: "run_new_def",
      returnValue: Promise.resolve({ success: true, data: "fresh" }),
    };
    const startWorkflow = vi.fn().mockResolvedValue(mockNewRun);

    const key = getDeduplicationKey("test", "example.com");
    const { result, deduplicated, source } = await startWithDeduplication(
      key,
      startWorkflow,
    );

    expect(startWorkflow).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, data: "fresh" });
    expect(deduplicated).toBe(false);
    expect(source).toBe("new");
  });

  it("deduplicates concurrent requests on same instance (in-memory)", async () => {
    let resolveWorkflow: ((value: unknown) => void) | undefined;
    const returnValue = new Promise((resolve) => {
      resolveWorkflow = resolve;
    });

    const mockRun = {
      runId: "run_concurrent",
      returnValue,
    };

    const startWorkflow = vi.fn().mockResolvedValue(mockRun);
    const key = getDeduplicationKey("test", "concurrent.com");

    // Start two concurrent requests
    const promise1 = startWithDeduplication(key, startWorkflow);
    const promise2 = startWithDeduplication(key, startWorkflow);

    // Resolve the workflow
    resolveWorkflow?.({ success: true, data: "shared" });

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Only one workflow should be started
    expect(startWorkflow).toHaveBeenCalledTimes(1);

    // Both get the same result
    expect(result1.result).toEqual({ success: true, data: "shared" });
    expect(result2.result).toEqual({ success: true, data: "shared" });
  });

  it("fails open when Redis is unavailable", async () => {
    const { getRedis } = await import("@/lib/redis");
    vi.mocked(getRedis).mockReturnValueOnce(undefined);

    const mockRun = {
      runId: "run_no_redis",
      returnValue: Promise.resolve({ success: true }),
    };
    const startWorkflow = vi.fn().mockResolvedValue(mockRun);

    const key = getDeduplicationKey("test", "example.com");
    const { result, source } = await startWithDeduplication(key, startWorkflow);

    expect(startWorkflow).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
    expect(source).toBe("new");
  });

  it("propagates workflow errors", async () => {
    const mockRun = {
      runId: "run_error",
      returnValue: Promise.reject(new Error("Workflow failed")),
    };
    const startWorkflow = vi.fn().mockResolvedValue(mockRun);

    const key = getDeduplicationKey("test", "example.com");

    await expect(startWithDeduplication(key, startWorkflow)).rejects.toThrow(
      "Workflow failed",
    );
  });
});

describe("getOrStartWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllPendingRuns();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
  });

  afterEach(() => {
    clearAllPendingRuns();
  });

  it("returns existing runId when found in Redis and still running", async () => {
    const existingRunId = "run_existing_789";
    mockRedis.get.mockResolvedValue(existingRunId);

    mockGetRun.mockReturnValue({
      status: Promise.resolve("running"),
    });

    const startWorkflow = vi.fn();
    const key = getDeduplicationKey("screenshot", "example.com");

    const { runId, started } = await getOrStartWorkflow(key, startWorkflow);

    expect(startWorkflow).not.toHaveBeenCalled();
    expect(runId).toBe(existingRunId);
    expect(started).toBe(false);
  });

  it("starts new workflow when no existing run in Redis", async () => {
    const mockRun = { runId: "run_new_abc" };
    const startWorkflow = vi.fn().mockResolvedValue(mockRun);

    const key = getDeduplicationKey("screenshot", "example.com");
    const { runId, started } = await getOrStartWorkflow(key, startWorkflow);

    expect(startWorkflow).toHaveBeenCalledTimes(1);
    expect(runId).toBe("run_new_abc");
    expect(started).toBe(true);

    // Should store in Redis
    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringContaining("workflow:run:screenshot:"),
      "run_new_abc",
      { nx: true, ex: 300 },
    );
  });

  it("starts new workflow when existing run is completed", async () => {
    const existingRunId = "run_completed_xyz";
    mockRedis.get.mockResolvedValue(existingRunId);

    mockGetRun.mockReturnValue({
      status: Promise.resolve("completed"),
    });

    const mockRun = { runId: "run_new_replacement" };
    const startWorkflow = vi.fn().mockResolvedValue(mockRun);

    const key = getDeduplicationKey("screenshot", "example.com");
    const { runId, started } = await getOrStartWorkflow(key, startWorkflow);

    expect(startWorkflow).toHaveBeenCalledTimes(1);
    expect(runId).toBe("run_new_replacement");
    expect(started).toBe(true);
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

describe("hasPendingRun", () => {
  afterEach(() => {
    clearAllPendingRuns();
  });

  it("returns false for unknown key", () => {
    expect(hasPendingRun("unknown:key")).toBe(false);
  });
});
