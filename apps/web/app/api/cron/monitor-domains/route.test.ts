import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquireMonitorLock: vi.fn<(trackedDomainId: string) => Promise<string | null>>(),
  getMonitoredSnapshotIds: vi.fn<() => Promise<string[]>>(),
  getVerifiedDomainsWithoutSnapshots: vi.fn<() => Promise<unknown[]>>(),
  releaseMonitorLock: vi.fn<(trackedDomainId: string, ownerToken: string) => Promise<void>>(),
  start: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("workflow/api", () => ({ start: mocks.start }));
vi.mock("@domainstack/workflows/monitor-lock", () => ({
  acquireMonitorLock: mocks.acquireMonitorLock,
  releaseMonitorLock: mocks.releaseMonitorLock,
}));
vi.mock("@domainstack/workflows/detect-changes", () => ({
  detectChangesWorkflow: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@domainstack/workflows/initialize-snapshot", () => ({
  initializeSnapshotWorkflow: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@domainstack/db/queries/snapshots", () => ({
  getMonitoredSnapshotIds: mocks.getMonitoredSnapshotIds,
  getVerifiedDomainsWithoutSnapshots: mocks.getVerifiedDomainsWithoutSnapshots,
}));

import { GET } from "@/app/api/cron/monitor-domains/route";

describe("monitor domains cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    mocks.getVerifiedDomainsWithoutSnapshots.mockResolvedValue([]);
    mocks.getMonitoredSnapshotIds.mockResolvedValue(["tracked-1"]);
    mocks.acquireMonitorLock.mockResolvedValue("owner-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("releases an acquired lock when workflow startup fails", async () => {
    mocks.start.mockRejectedValue(new Error("Workflow API unavailable"));

    const response = await GET(
      new Request("https://domainstack.io/api/cron/monitor-domains", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      baselines: { started: 0, total: 0 },
      monitoring: { started: 0, total: 1, skippedInFlight: 0 },
    });
    expect(mocks.releaseMonitorLock).toHaveBeenCalledWith("tracked-1", "owner-1");
  });

  it("starts all monitors while never exceeding the batch concurrency limit", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `tracked-${i}`);
    mocks.getMonitoredSnapshotIds.mockResolvedValue(ids);

    let inFlight = 0;
    let maxInFlight = 0;
    mocks.start.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight--;
      return undefined;
    });

    const response = await GET(
      new Request("https://domainstack.io/api/cron/monitor-domains", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      baselines: { started: 0, total: 0 },
      monitoring: { started: 120, total: 120, skippedInFlight: 0 },
    });
    expect(mocks.start).toHaveBeenCalledTimes(120);
    expect(maxInFlight).toBeLessThanOrEqual(50);
  });
});
