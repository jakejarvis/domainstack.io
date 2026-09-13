import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVerifiedTrackedDomainIds: vi.fn<() => Promise<string[]>>(),
  start: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("workflow/api", () => ({ start: mocks.start }));
vi.mock("@/workflows/expiry", () => ({
  expiryWorkflow: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@domainstack/db/queries/tracked-domains", () => ({
  getVerifiedTrackedDomainIds: mocks.getVerifiedTrackedDomainIds,
}));

import { GET } from "@/app/api/cron/check-expiry/route";
import { expiryWorkflow } from "@/workflows/expiry";

describe("check expiry cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 and performs no query or start without valid authorization", async () => {
    const response = await GET(new Request("https://domainstack.io/api/cron/check-expiry"));

    expect(response.status).toBe(401);
    expect(mocks.getVerifiedTrackedDomainIds).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("starts exactly one expiryWorkflow per verified tracked domain", async () => {
    mocks.getVerifiedTrackedDomainIds.mockResolvedValue(["td-1", "td-2", "td-3"]);
    mocks.start.mockResolvedValue(undefined);

    const response = await GET(
      new Request("https://domainstack.io/api/cron/check-expiry", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ started: 3 });
    expect(mocks.start).toHaveBeenCalledTimes(3);
    for (const id of ["td-1", "td-2", "td-3"]) {
      expect(mocks.start).toHaveBeenCalledWith(expiryWorkflow, [{ trackedDomainId: id }]);
    }
  });

  it("reports partial start failures without dropping the other ids", async () => {
    mocks.getVerifiedTrackedDomainIds.mockResolvedValue(["td-1", "td-2", "td-3"]);
    mocks.start.mockImplementation(async (...args: unknown[]) => {
      const [{ trackedDomainId }] = args[1] as [{ trackedDomainId: string }];
      if (trackedDomainId === "td-2") throw new Error("Workflow API unavailable");
      return undefined;
    });

    const response = await GET(
      new Request("https://domainstack.io/api/cron/check-expiry", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ started: 2 });
    expect(mocks.start).toHaveBeenCalledTimes(3);
  });
});
