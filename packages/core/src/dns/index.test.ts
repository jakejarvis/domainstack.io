/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

const { getCachedDns } = await import("@domainstack/db/queries/dns");
const { persistDnsRecords } = await import("./index");

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
});

describe("persistDnsRecords", () => {
  it("stores a subdomain's CNAME under the subdomain and reads it back from the cache", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const a = { type: "A" as const, name: "edge.cdn.test", value: "192.0.2.1", ttl: 60 };
    const cname = {
      type: "CNAME" as const,
      name: "api.example.com",
      value: "edge.cdn.test",
      ttl: 300,
    };

    await persistDnsRecords("api.example.com", {
      records: [a, cname],
      resolver: "cloudflare",
      recordsWithExpiry: [
        { ...a, expiresAt },
        { ...cname, expiresAt },
      ],
    });

    const cached = await getCachedDns("api.example.com");
    expect(cached.stale).toBe(false);
    expect(cached.data?.records).toEqual([
      expect.objectContaining({ type: "A", value: "192.0.2.1" }),
      expect.objectContaining({ type: "CNAME", name: "api.example.com", value: "edge.cdn.test" }),
    ]);

    // Nothing was written for the registrable parent.
    expect((await getCachedDns("example.com")).data).toBeNull();
  });
});
