/* @vitest-environment node */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock the DB client before importing anything else
vi.mock("@/lib/db/client", async () => {
  const { makePGliteDb } = await import("@/lib/db/pglite");
  const { db } = await makePGliteDb();
  return { db };
});

import { db } from "@/lib/db/client";
import { screenshots } from "@/lib/db/schema";
import { ttlForScreenshot } from "@/lib/db/ttl";
import { getScreenshotByDomainId, upsertScreenshot } from "./screenshots";

let testDomainId: string;

beforeAll(async () => {
  // Create a test domain
  const { upsertDomain } = await import("./domains");
  const domain = await upsertDomain({
    name: "test-screenshot.com",
    tld: "com",
    unicodeName: "test-screenshot.com",
  });
  testDomainId = domain.id;
});

afterAll(async () => {
  // PGlite cleanup handled automatically
});

beforeEach(async () => {
  // Clear screenshots table before each test
  await db.delete(screenshots);
});

describe("upsertScreenshot", () => {
  it("inserts a new screenshot record", async () => {
    const now = new Date();
    const expiresAt = ttlForScreenshot(now);

    await upsertScreenshot({
      domainId: testDomainId,
      url: "https://example.com/screenshot.webp",
      pathname: "abc123/1200x630.webp",
      width: 1200,
      height: 630,
      source: "direct_https",
      notFound: false,
      fetchedAt: now,
      expiresAt,
    });

    const rows = await db.select().from(screenshots);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toBe("https://example.com/screenshot.webp");
    expect(rows[0]?.width).toBe(1200);
    expect(rows[0]?.height).toBe(630);
  });

  it("updates an existing screenshot record", async () => {
    const now = new Date();
    const expiresAt = ttlForScreenshot(now);

    // Insert first
    await upsertScreenshot({
      domainId: testDomainId,
      url: "https://example.com/screenshot-old.webp",
      pathname: "old123/1200x630.webp",
      width: 1200,
      height: 630,
      source: "direct_http",
      notFound: false,
      fetchedAt: now,
      expiresAt,
    });

    // Update with new data
    const laterDate = new Date(now.getTime() + 1000);
    await upsertScreenshot({
      domainId: testDomainId,
      url: "https://example.com/screenshot-new.webp",
      pathname: "new123/1200x630.webp",
      width: 1200,
      height: 630,
      source: "direct_https",
      notFound: false,
      fetchedAt: laterDate,
      expiresAt,
    });

    const rows = await db.select().from(screenshots);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toBe("https://example.com/screenshot-new.webp");
    expect(rows[0]?.source).toBe("direct_https");
  });

  it("handles notFound flag", async () => {
    const now = new Date();
    const expiresAt = ttlForScreenshot(now);

    await upsertScreenshot({
      domainId: testDomainId,
      url: null,
      pathname: null,
      width: 1200,
      height: 630,
      source: null,
      notFound: true,
      fetchedAt: now,
      expiresAt,
    });

    const rows = await db.select().from(screenshots);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.notFound).toBe(true);
    expect(rows[0]?.url).toBeNull();
  });
});

describe("getScreenshotByDomainId", () => {
  it("returns null when domain has no screenshot", async () => {
    const result = await getScreenshotByDomainId(testDomainId);
    expect(result).toBeNull();
  });

  it("returns screenshot when not expired", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600 * 1000); // 1 hour from now

    await upsertScreenshot({
      domainId: testDomainId,
      url: "https://example.com/screenshot.webp",
      pathname: "abc123/1200x630.webp",
      width: 1200,
      height: 630,
      source: "direct_https",
      notFound: false,
      fetchedAt: now,
      expiresAt,
    });

    const result = await getScreenshotByDomainId(testDomainId);
    expect(result).not.toBeNull();
    expect(result?.url).toBe("https://example.com/screenshot.webp");
  });

  it("returns null when screenshot is expired", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() - 1000); // 1 second ago

    await upsertScreenshot({
      domainId: testDomainId,
      url: "https://example.com/screenshot.webp",
      pathname: "abc123/1200x630.webp",
      width: 1200,
      height: 630,
      source: "direct_https",
      notFound: false,
      fetchedAt: now,
      expiresAt,
    });

    const result = await getScreenshotByDomainId(testDomainId);
    expect(result).toBeNull();
  });
});
