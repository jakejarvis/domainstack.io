/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

const { dnsChecks } = await import("@domainstack/db/schema");
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

  it("caches a lookup that found no records instead of treating it as a miss", async () => {
    const before = Date.now();
    await persistDnsRecords("missing.example.com", {
      records: [],
      resolver: "google",
      recordsWithExpiry: [],
    });

    const cached = await getCachedDns("missing.example.com");
    expect(cached.stale).toBe(false);
    expect(cached.data).toEqual({ records: [], resolver: "google" });
    // Cached for the default DNS TTL (1 hour).
    expect(cached.expiresAt?.getTime()).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
  });

  it("expires the lookup with its first expiring record", async () => {
    const soon = new Date(Date.now() + 60_000);
    const later = new Date(Date.now() + 600_000);
    await persistDnsRecords("example.com", {
      records: [],
      resolver: "cloudflare",
      recordsWithExpiry: [
        {
          type: "NS",
          name: "example.com",
          value: "ns1.example.net",
          ttl: 600,
          expiresAt: later.toISOString(),
        },
        {
          type: "A",
          name: "example.com",
          value: "192.0.2.1",
          ttl: 60,
          expiresAt: soon.toISOString(),
        },
      ],
    });

    const [check] = await db.select().from(dnsChecks);
    expect(check).toMatchObject({ resolver: "cloudflare", expiresAt: soon });
  });

  it("serves an empty answer that replaced earlier records from the cache", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    await persistDnsRecords("example.com", {
      records: [],
      resolver: "cloudflare",
      recordsWithExpiry: [
        { type: "A", name: "example.com", value: "192.0.2.1", ttl: 60, expiresAt },
      ],
    });
    await persistDnsRecords("example.com", {
      records: [],
      resolver: "cloudflare",
      recordsWithExpiry: [],
    });

    const cached = await getCachedDns("example.com");
    expect(cached.data?.records).toEqual([]);
    expect(cached.stale).toBe(false);
  });
});
