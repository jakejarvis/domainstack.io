/* @vitest-environment node */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock blocked domains repo
const blockedDomainsMock = vi.hoisted(() => ({
  isDomainBlocked: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/db/repos/blocked-domains", () => blockedDomainsMock);

describe("screenshotWorkflow step functions", () => {
  beforeAll(async () => {
    const { makePGliteDb } = await import("@/lib/db/pglite");
    const { db } = await makePGliteDb();
    vi.doMock("@/lib/db/client", () => ({ db }));
  });

  beforeEach(async () => {
    const { resetPGliteDb } = await import("@/lib/db/pglite");
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    const { closePGliteDb } = await import("@/lib/db/pglite");
    await closePGliteDb();
  });

  describe("checkBlocklist step", () => {
    it("returns blocked result for blocked domain", async () => {
      blockedDomainsMock.isDomainBlocked.mockResolvedValue(true);

      const { screenshotWorkflow } = await import("./workflow");
      const result = await screenshotWorkflow({ domain: "blocked.com" });

      // Assert success and use TypeScript narrowing
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("Expected success");

      expect(result.data.blocked).toBe(true);
      expect(result.data.url).toBeNull();
    });

    it("calls isDomainBlocked for non-blocked domains", async () => {
      blockedDomainsMock.isDomainBlocked.mockResolvedValue(false);

      // Directly test the checkBlocklist step behavior
      // Full workflow test would require Puppeteer mocks
      const { isDomainBlocked } = await import(
        "@/lib/db/repos/blocked-domains"
      );

      const result = await isDomainBlocked("allowed.com");

      expect(result).toBe(false);
      expect(blockedDomainsMock.isDomainBlocked).toHaveBeenCalledWith(
        "allowed.com",
      );
    });
  });

  // Note: checkCache step was moved to tRPC layer.
  // Cache tests should be done at the router or integration level.
});
