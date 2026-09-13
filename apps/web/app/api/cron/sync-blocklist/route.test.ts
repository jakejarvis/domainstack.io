/* @vitest-environment node */
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/mocks/server";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

const { blockedDomains } = await import("@domainstack/db/schema");
const { eq } = await import("@domainstack/db/drizzle");
const { syncBlockedDomains } = await import("@domainstack/db/queries/blocked-domains");

const mocks = vi.hoisted(() => ({
  blocklistSources: vi.fn<() => Promise<string[]>>(),
}));

vi.mock("@/lib/flags", () => ({
  blocklistSources: mocks.blocklistSources,
}));

const { GET } = await import("@/app/api/cron/sync-blocklist/route");

function makeRequest(): Request {
  return new Request("https://domainstack.io/api/cron/sync-blocklist", {
    headers: { Authorization: "Bearer test-secret" },
  });
}

async function blockedDomainNames(): Promise<string[]> {
  const rows = await db.select({ domain: blockedDomains.domain }).from(blockedDomains);
  return rows.map((row) => row.domain).sort();
}

vi.stubEnv("CRON_SECRET", "test-secret");

afterAll(async () => {
  vi.unstubAllEnvs();
  await closePGliteDb();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(blockedDomains);
});

afterEach(() => {
  server.resetHandlers();
});

describe("sync blocklist cron", () => {
  it("syncs the union of two successful sources", async () => {
    mocks.blocklistSources.mockResolvedValue([
      "https://blocklist-a.test/list.txt",
      "https://blocklist-b.test/list.txt",
    ]);
    server.use(
      http.get(
        "https://blocklist-a.test/list.txt",
        () => new HttpResponse("a.example\nb.example\n"),
      ),
      http.get(
        "https://blocklist-b.test/list.txt",
        () => new HttpResponse("b.example\nc.example\n"),
      ),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sources: 2,
      added: 3,
      removed: 0,
      total: 3,
    });
    expect(await blockedDomainNames()).toEqual(["a.example", "b.example", "c.example"]);
  });

  it("returns 502 and leaves the table untouched when a source responds non-2xx", async () => {
    await db
      .insert(blockedDomains)
      .values([{ domain: "a.example" }, { domain: "b.example" }, { domain: "c.example" }]);

    mocks.blocklistSources.mockResolvedValue([
      "https://blocklist-a.test/list.txt",
      "https://blocklist-b.test/list.txt",
    ]);
    server.use(
      http.get("https://blocklist-a.test/list.txt", () => new HttpResponse("a.example\n")),
      http.get("https://blocklist-b.test/list.txt", () => new HttpResponse(null, { status: 503 })),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      sources: 2,
      failed: 1,
      added: 0,
      removed: 0,
      skipped: true,
    });
    expect(await blockedDomainNames()).toEqual(["a.example", "b.example", "c.example"]);
  });

  it("returns 502 and leaves the table untouched on a network error", async () => {
    await db.insert(blockedDomains).values([{ domain: "a.example" }, { domain: "b.example" }]);

    mocks.blocklistSources.mockResolvedValue([
      "https://blocklist-a.test/list.txt",
      "https://blocklist-b.test/list.txt",
    ]);
    server.use(
      http.get("https://blocklist-a.test/list.txt", () => new HttpResponse("a.example\n")),
      http.get("https://blocklist-b.test/list.txt", () => HttpResponse.error()),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      sources: 2,
      failed: 1,
      added: 0,
      removed: 0,
      skipped: true,
    });
    expect(await blockedDomainNames()).toEqual(["a.example", "b.example"]);
  });
});

describe("syncBlockedDomains", () => {
  it("scales past the 65,535 bind-parameter limit and prunes stale rows", async () => {
    const domainCount = 70_000;
    const domains = Array.from({ length: domainCount }, (_, i) => `domain-${i}.example`);

    const first = await syncBlockedDomains(domains);
    expect(first.added).toBe(domainCount);
    expect(first.removed).toBe(0);
    expect(first.total).toBe(domainCount);

    const rowsAfterFirst = await db.select({ domain: blockedDomains.domain }).from(blockedDomains);
    expect(rowsAfterFirst.length).toBe(domainCount);

    const subset = domains.slice(0, 10);
    const second = await syncBlockedDomains(subset);
    expect(second.added).toBe(0);
    expect(second.removed).toBe(domainCount - 10);
    expect(second.total).toBe(10);

    const rowsAfterSecond = await db.select({ domain: blockedDomains.domain }).from(blockedDomains);
    expect(rowsAfterSecond.length).toBe(10);
  }, 60_000);

  it("re-syncing an identical list changes nothing and preserves addedAt", async () => {
    await syncBlockedDomains(["a.example", "b.example"]);
    const before = await db
      .select({ addedAt: blockedDomains.addedAt })
      .from(blockedDomains)
      .where(eq(blockedDomains.domain, "a.example"));

    const result = await syncBlockedDomains(["a.example", "b.example"]);

    expect(result).toEqual({ added: 0, removed: 0, total: 2 });

    const after = await db
      .select({ addedAt: blockedDomains.addedAt })
      .from(blockedDomains)
      .where(eq(blockedDomains.domain, "a.example"));
    expect(after[0].addedAt).toEqual(before[0].addedAt);
  });
});
