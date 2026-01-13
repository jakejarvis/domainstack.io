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
import { ttlForFavicon } from "@/lib/ttl";
import { getFaviconById, upsertFavicon } from "./favicons";

let testDomainId: string;

beforeAll(async () => {
  // Create a test domain
  const { upsertDomain } = await import("./domains");
  const domain = await upsertDomain({
    name: "favicon.test",
    tld: "test",
    unicodeName: "favicon.test",
  });
  testDomainId = domain.id;
});

afterAll(async () => {
  // Close PGlite client to prevent file handle leaks
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
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
      url: "https://example.test/favicon.webp",
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
    expect(rows[0].url).toBe("https://example.test/favicon.webp");
    expect(rows[0].source).toBe("duckduckgo");
  });

  it("updates an existing favicon record", async () => {
    const now = new Date();
    const expiresAt = ttlForFavicon(now);

    // Insert first
    await upsertFavicon({
      domainId: testDomainId,
      url: "https://example.test/favicon-old.webp",
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
      url: "https://example.test/favicon-new.webp",
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
    expect(rows[0].url).toBe("https://example.test/favicon-new.webp");
    expect(rows[0].source).toBe("duckduckgo");
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
    expect(rows[0].notFound).toBe(true);
    expect(rows[0].url).toBeNull();
  });
});

describe("getFaviconById", () => {
  it("returns null data when domain has no favicon", async () => {
    const result = await getFaviconById(testDomainId);
    expect(result.data).toBeNull();
    expect(result.stale).toBe(false);
    expect(result.expiresAt).toBeNull();
  });

  it("returns fresh favicon when not expired", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600 * 1000); // 1 hour from now

    await upsertFavicon({
      domainId: testDomainId,
      url: "https://example.test/favicon.webp",
      pathname: "abc123/32x32.webp",
      size: 32,
      source: "duckduckgo",
      notFound: false,
      upstreamStatus: 200,
      upstreamContentType: "image/x-icon",
      fetchedAt: now,
      expiresAt,
    });

    const result = await getFaviconById(testDomainId);
    expect(result.data).not.toBeNull();
    expect(result.data?.url).toBe("https://example.test/favicon.webp");
    expect(result.stale).toBe(false);
    expect(result.expiresAt).toEqual(expiresAt);
  });

  it("returns stale favicon when expired", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() - 1000); // 1 second ago

    await upsertFavicon({
      domainId: testDomainId,
      url: "https://example.test/favicon.webp",
      pathname: "abc123/32x32.webp",
      size: 32,
      source: "duckduckgo",
      notFound: false,
      upstreamStatus: 200,
      upstreamContentType: "image/x-icon",
      fetchedAt: now,
      expiresAt,
    });

    const result = await getFaviconById(testDomainId);
    // Stale-while-revalidate: returns data even when expired
    expect(result.data).not.toBeNull();
    expect(result.data?.url).toBe("https://example.test/favicon.webp");
    expect(result.stale).toBe(true);
    expect(result.expiresAt).toEqual(expiresAt);
  });
});
