/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

describe("persistDnsRecordsStep", () => {
  beforeEach(async () => {
    await resetPGliteDb();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await closePGliteDb();
  });

  it("persists DNS records to database", async () => {
    const { upsertDomain } = await import("@domainstack/db/queries/domains");
    const domain = await upsertDomain({
      name: "persist.com",
      tld: "com",
      unicodeName: "persist.com",
    });

    const { persistDnsRecordsStep } = await import("./dns");
    await persistDnsRecordsStep("persist.com", {
      resolver: "cloudflare",
      records: [{ type: "A", name: "persist.com", value: "1.2.3.4", ttl: 300 }],
      recordsWithExpiry: [
        {
          type: "A",
          name: "persist.com",
          value: "1.2.3.4",
          ttl: 300,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        },
      ],
      dnssec: { status: "insecure", ds: [], dnskeys: [] },
      dnssecExpiresAt: new Date(Date.now() + 300_000).toISOString(),
    });

    // Use the PGlite db instance (already set as the singleton)
    const { dnsRecords } = await import("@domainstack/db/schema");
    const { eq } = await import("@domainstack/db/drizzle");

    const rows = await db.select().from(dnsRecords).where(eq(dnsRecords.domainId, domain.id));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.type === "A")).toBe(true);
  });

  describe("DNSSEC", () => {
    const DS = { keyTag: 2371, algorithm: 13, digestType: 2, digest: "abcd" };

    async function persist(
      domain: string,
      dnssec: Parameters<typeof import("./dns").persistDnsRecordsStep>[1]["dnssec"] = {
        status: "secure",
        ds: [DS],
        dnskeys: [],
      },
      dnssecExpiresAt = new Date(Date.now() + 300_000).toISOString(),
    ) {
      const { persistDnsRecordsStep } = await import("./dns");
      await persistDnsRecordsStep(domain, {
        resolver: "cloudflare",
        records: [{ type: "A", name: domain, value: "1.2.3.4", ttl: 300 }],
        recordsWithExpiry: [
          {
            type: "A",
            name: domain,
            value: "1.2.3.4",
            ttl: 300,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          },
        ],
        dnssec,
        dnssecExpiresAt,
      });
    }

    it("round-trips the DNSSEC observation through the cache", async () => {
      await persist("signed.com", {
        status: "secure",
        ds: [DS],
        dnskeys: [{ flags: 257, protocol: 3, algorithm: 13, isKsk: true }],
      });

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("signed.com");

      expect(cached.stale).toBe(false);
      expect(cached.data?.dnssec).toEqual({
        status: "secure",
        ds: [DS],
        dnskeys: [{ flags: 257, protocol: 3, algorithm: 13, isKsk: true }],
      });
    });

    it("updates the observation in place on a later persist", async () => {
      await persist("flip.com", { status: "secure", ds: [DS], dnskeys: [] });
      await persist("flip.com", { status: "bogus", ds: [DS], dnskeys: [] });

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      expect((await getCachedDns("flip.com")).data?.dnssec?.status).toBe("bogus");
    });

    it("is stale once the DNSSEC observation expires", async () => {
      await persist("expired.com", undefined, new Date(Date.now() - 1000).toISOString());

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      expect((await getCachedDns("expired.com")).stale).toBe(true);
    });

    it("treats records cached before DNSSEC tracking as stale", async () => {
      await persist("legacy.com");
      const { dnssecChecks } = await import("@domainstack/db/schema");
      await db.delete(dnssecChecks);

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("legacy.com");

      expect(cached.stale).toBe(true);
      expect(cached.data?.records.length).toBeGreaterThan(0);
      expect(cached.data?.dnssec).toBeUndefined();
    });

    it("cross-checks against the registry's persisted DNSSEC data", async () => {
      await persist("mismatch.com");
      const { upsertDomain } = await import("@domainstack/db/queries/domains");
      const { upsertRegistration } = await import("@domainstack/db/queries/registrations");
      const domain = await upsertDomain({
        name: "mismatch.com",
        tld: "com",
        unicodeName: "mismatch.com",
      });
      await upsertRegistration({
        domainId: domain.id,
        isRegistered: true,
        source: "rdap",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 300_000),
        dnssec: { enabled: true, dsRecords: [{ ...DS, digest: "ffff" }] },
      });

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("mismatch.com");

      expect(cached.data?.dnssec?.registry).toEqual({
        enabled: true,
        mismatch: true,
        reason: "ds_differs",
      });

      const { getRegistryDnssec } = await import("@domainstack/db/queries/registrations");
      expect(await getRegistryDnssec("mismatch.com")).toEqual({
        enabled: true,
        dsRecords: [{ ...DS, digest: "ffff" }],
      });
    });
  });
});
