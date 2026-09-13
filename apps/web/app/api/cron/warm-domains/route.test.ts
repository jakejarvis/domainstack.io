import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRecentlyAccessedDomains: vi.fn<() => Promise<string[]>>(),
  start: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("workflow/api", () => ({ start: mocks.start }));
vi.mock("@/workflows/warm-domains", () => ({
  warmDomainWorkflow: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@domainstack/db/queries/domains", () => ({
  getRecentlyAccessedDomains: mocks.getRecentlyAccessedDomains,
}));

import { GET } from "@/app/api/cron/warm-domains/route";
import { warmDomainWorkflow } from "@/workflows/warm-domains";

describe("warm domains cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 and performs no query or start without valid authorization", async () => {
    const response = await GET(new Request("https://domainstack.io/api/cron/warm-domains"));

    expect(response.status).toBe(401);
    expect(mocks.getRecentlyAccessedDomains).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("starts exactly one warmDomainWorkflow per recently accessed domain", async () => {
    mocks.getRecentlyAccessedDomains.mockResolvedValue(["a.com", "b.com", "c.com"]);
    mocks.start.mockResolvedValue(undefined);

    const response = await GET(
      new Request("https://domainstack.io/api/cron/warm-domains", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ started: 3 });
    expect(mocks.start).toHaveBeenCalledTimes(3);
    for (const domain of ["a.com", "b.com", "c.com"]) {
      expect(mocks.start).toHaveBeenCalledWith(warmDomainWorkflow, [{ domain }]);
    }
  });

  it("reports partial start failures without dropping the other domains", async () => {
    mocks.getRecentlyAccessedDomains.mockResolvedValue(["a.com", "b.com", "c.com"]);
    mocks.start.mockImplementation(async (...args: unknown[]) => {
      const [{ domain }] = args[1] as [{ domain: string }];
      if (domain === "b.com") throw new Error("Workflow API unavailable");
      return undefined;
    });

    const response = await GET(
      new Request("https://domainstack.io/api/cron/warm-domains", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ started: 2 });
    expect(mocks.start).toHaveBeenCalledTimes(3);
  });

  it("returns started: 0 and never calls start for zero domains", async () => {
    mocks.getRecentlyAccessedDomains.mockResolvedValue([]);

    const response = await GET(
      new Request("https://domainstack.io/api/cron/warm-domains", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ started: 0 });
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
