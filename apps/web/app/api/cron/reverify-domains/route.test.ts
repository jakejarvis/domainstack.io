import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVerifiedTrackedDomainIds: vi.fn<() => Promise<string[]>>(),
  start: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("workflow/api", () => ({ start: mocks.start }));
vi.mock("@domainstack/workflows/reverify-ownership", () => ({
  reverifyOwnershipWorkflow: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@domainstack/db/queries/tracked-domains", () => ({
  getVerifiedTrackedDomainIds: mocks.getVerifiedTrackedDomainIds,
}));

import { GET } from "@/app/api/cron/reverify-domains/route";
import { reverifyOwnershipWorkflow } from "@domainstack/workflows/reverify-ownership";

const authorized = () =>
  new Request("https://domainstack.io/api/cron/reverify-domains", {
    headers: { Authorization: "Bearer test-secret" },
  });

describe("reverify domains cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 and performs no query or start without valid authorization", async () => {
    const response = await GET(new Request("https://domainstack.io/api/cron/reverify-domains"));

    expect(response.status).toBe(401);
    expect(mocks.getVerifiedTrackedDomainIds).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("starts exactly one reverifyOwnershipWorkflow per verified tracked domain", async () => {
    mocks.getVerifiedTrackedDomainIds.mockResolvedValue(["td-1", "td-2", "td-3"]);
    mocks.start.mockResolvedValue(undefined);

    const response = await GET(authorized());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ started: 3, failed: 0 });
    expect(mocks.start).toHaveBeenCalledTimes(3);
    for (const id of ["td-1", "td-2", "td-3"]) {
      expect(mocks.start).toHaveBeenCalledWith(reverifyOwnershipWorkflow, [
        { trackedDomainId: id },
      ]);
    }
  });

  it("returns 500 with counts on partial start failure without dropping the other ids", async () => {
    mocks.getVerifiedTrackedDomainIds.mockResolvedValue(["td-1", "td-2", "td-3"]);
    mocks.start.mockImplementation(async (...args: unknown[]) => {
      const [{ trackedDomainId }] = args[1] as [{ trackedDomainId: string }];
      if (trackedDomainId === "td-2") throw new Error("Workflow API unavailable");
      return undefined;
    });

    const response = await GET(authorized());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ started: 2, failed: 1 });
    expect(mocks.start).toHaveBeenCalledTimes(3);
  });

  it("returns 200 with zero counts and never calls start for zero domains", async () => {
    mocks.getVerifiedTrackedDomainIds.mockResolvedValue([]);

    const response = await GET(authorized());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ started: 0, failed: 0 });
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
