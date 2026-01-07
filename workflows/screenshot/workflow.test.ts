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

      expect(result.data.blocked).toBe(true);
      expect(result.data.url).toBeNull();
    });

    it("verifies blocklist is checked for non-blocked domains", async () => {
      blockedDomainsMock.isDomainBlocked.mockResolvedValue(false);

      // We can't test the full flow without mocking Puppeteer,
      // but we can verify the blocklist check is called
      const { screenshotWorkflow } = await import("./workflow");

      // Set up a cached result so we don't hit Puppeteer
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      const { upsertScreenshot } = await import("@/lib/db/repos/screenshots");

      const domain = await upsertDomain({
        name: "allowed.com",
        tld: "com",
        unicodeName: "allowed.com",
      });

      await upsertScreenshot({
        domainId: domain.id,
        url: "https://allowed.webp",
        pathname: "allowed.webp",
        width: 1200,
        height: 630,
        source: "direct_https",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const _result = await screenshotWorkflow({ domain: "allowed.com" });

      // Verify blocklist was checked
      expect(blockedDomainsMock.isDomainBlocked).toHaveBeenCalledWith(
        "allowed.com",
      );
    });
  });

  // Note: checkCache step was moved to tRPC layer.
  // Cache tests should be done at the router or integration level.
});
