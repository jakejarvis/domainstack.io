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

      expect(result.blocked).toBe(true);
      expect(result.url).toBeNull();
      expect(result.cached).toBe(false);
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

      const result = await screenshotWorkflow({ domain: "allowed.com" });

      // Verify blocklist was checked
      expect(blockedDomainsMock.isDomainBlocked).toHaveBeenCalledWith(
        "allowed.com",
      );
      expect(result.blocked).toBe(false);
      expect(result.cached).toBe(true);
    });
  });

  describe("checkCache step", () => {
    it("returns cached screenshot when present", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      const { upsertScreenshot } = await import("@/lib/db/repos/screenshots");

      const domain = await upsertDomain({
        name: "cached-screenshot.com",
        tld: "com",
        unicodeName: "cached-screenshot.com",
      });

      await upsertScreenshot({
        domainId: domain.id,
        url: "https://cached-screenshot.webp",
        pathname: "cached.webp",
        width: 1200,
        height: 630,
        source: "direct_https",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const { screenshotWorkflow } = await import("./workflow");
      const result = await screenshotWorkflow({
        domain: "cached-screenshot.com",
      });

      expect(result.cached).toBe(true);
      expect(result.url).toBe("https://cached-screenshot.webp");
      expect(result.blocked).toBe(false);
    });

    it("returns null url for cached failure (negative cache)", async () => {
      const { upsertDomain } = await import("@/lib/db/repos/domains");
      const { upsertScreenshot } = await import("@/lib/db/repos/screenshots");

      const domain = await upsertDomain({
        name: "failed-screenshot.com",
        tld: "com",
        unicodeName: "failed-screenshot.com",
      });

      // Simulate a cached failure by inserting a record with url: null
      // and notFound: true to indicate it's a negative cache hit
      await upsertScreenshot({
        domainId: domain.id,
        url: null, // Failed screenshot
        pathname: null,
        width: 1200,
        height: 630,
        source: null,
        notFound: true, // Mark as negative cache
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const { screenshotWorkflow } = await import("./workflow");
      const result = await screenshotWorkflow({
        domain: "failed-screenshot.com",
      });

      expect(result.cached).toBe(true);
      expect(result.url).toBeNull();
    });

    // Note: Testing "cache expired → fetch fresh" requires mocking Puppeteer,
    // which is difficult with dynamic imports. The captureScreenshot step
    // is better tested via integration tests or manual verification.
  });
});
