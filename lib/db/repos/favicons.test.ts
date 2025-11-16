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
import { favicons } from "@/lib/db/schema";
import { ttlForFavicon } from "@/lib/db/ttl";
import { getFaviconByDomainId, upsertFavicon } from "./favicons";

let testDomainId: string;

beforeAll(async () => {
  // Create a test domain
  const { upsertDomain } = await import("./domains");
  const domain = await upsertDomain({
    name: "test-favicon.com",
    tld: "com",
    unicodeName: "test-favicon.com",
  });
  testDomainId = domain.id;
});

afterAll(async () => {
  // PGlite cleanup handled automatically
});

beforeEach(async () => {
  // Clear favicons table before each test
  await db.delete(favicons);
});

describe("upsertFavicon", () => {
  it("inserts a new favicon record", async () => {
    const now = new Date();
    const expiresAt = ttlForFavicon(now);

    await upsertFavicon({
      domainId: testDomainId,
      url: "https://example.com/favicon.webp",
      pathname: "abc123/32x32.webp",
      size: 32,
      source: "duckduckgo",
      notFound: false,
      upstreamStatus: 200,
      upstreamContentType: "image/x-icon",
      fetchedAt: now,
      expiresAt,
    });

    const rows = await db.select().from(favicons);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toBe("https://example.com/favicon.webp");
    expect(rows[0]?.source).toBe("duckduckgo");
  });

  it("updates an existing favicon record", async () => {
    const now = new Date();
    const expiresAt = ttlForFavicon(now);

    // Insert first
    await upsertFavicon({
      domainId: testDomainId,
      url: "https://example.com/favicon-old.webp",
      pathname: "old123/32x32.webp",
      size: 32,
      source: "google",
      notFound: false,
      upstreamStatus: 200,
      upstreamContentType: "image/x-icon",
      fetchedAt: now,
      expiresAt,
    });

    // Update with new data
    const laterDate = new Date(now.getTime() + 1000);
    await upsertFavicon({
      domainId: testDomainId,
      url: "https://example.com/favicon-new.webp",
      pathname: "new123/32x32.webp",
      size: 32,
      source: "duckduckgo",
      notFound: false,
      upstreamStatus: 200,
      upstreamContentType: "image/webp",
      fetchedAt: laterDate,
      expiresAt,
    });

    const rows = await db.select().from(favicons);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.url).toBe("https://example.com/favicon-new.webp");
    expect(rows[0]?.source).toBe("duckduckgo");
  });

  it("handles notFound flag", async () => {
    const now = new Date();
    const expiresAt = ttlForFavicon(now);

    await upsertFavicon({
      domainId: testDomainId,
      url: null,
      pathname: null,
      size: 32,
      source: null,
      notFound: true,
      upstreamStatus: null,
      upstreamContentType: null,
      fetchedAt: now,
      expiresAt,
    });

    const rows = await db.select().from(favicons);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.notFound).toBe(true);
    expect(rows[0]?.url).toBeNull();
  });
});

describe("getFaviconByDomainId", () => {
  it("returns null when domain has no favicon", async () => {
    const result = await getFaviconByDomainId(testDomainId);
    expect(result).toBeNull();
  });

  it("returns favicon when not expired", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600 * 1000); // 1 hour from now

    await upsertFavicon({
      domainId: testDomainId,
      url: "https://example.com/favicon.webp",
      pathname: "abc123/32x32.webp",
      size: 32,
      source: "duckduckgo",
      notFound: false,
      upstreamStatus: 200,
      upstreamContentType: "image/x-icon",
      fetchedAt: now,
      expiresAt,
    });

    const result = await getFaviconByDomainId(testDomainId);
    expect(result).not.toBeNull();
    expect(result?.url).toBe("https://example.com/favicon.webp");
  });

  it("returns null when favicon is expired", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() - 1000); // 1 second ago

    await upsertFavicon({
      domainId: testDomainId,
      url: "https://example.com/favicon.webp",
      pathname: "abc123/32x32.webp",
      size: 32,
      source: "duckduckgo",
      notFound: false,
      upstreamStatus: 200,
      upstreamContentType: "image/x-icon",
      fetchedAt: now,
      expiresAt,
    });

    const result = await getFaviconByDomainId(testDomainId);
    expect(result).toBeNull();
  });
});
