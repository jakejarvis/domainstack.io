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
      dnssecDsAvailable: true,
      dnssecDnskeysAvailable: true,
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
      dsAvailable = true,
      dnskeysAvailable = true,
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
        dnssecDsAvailable: dsAvailable,
        dnssecDnskeysAvailable: dnskeysAvailable,
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

    it("records a genuinely first-ever indeterminate observation, bounded by TTL rather than permanently stale", async () => {
      await persist(
        "never-observed.com",
        { status: "indeterminate", ds: [], dnskeys: [] },
        new Date(Date.now() + 300_000).toISOString(),
      );

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("never-observed.com");

      // Present (not the "no row at all" case above) and fresh: a later request
      // won't force a full refetch just because DNSSEC has never succeeded yet.
      expect(cached.stale).toBe(false);
      expect(cached.data?.dnssec).toEqual({
        status: "indeterminate",
        ds: [],
        dnskeys: [],
        dnskeysAvailable: false,
      });
    });

    it("keeps a prior good status when a later observation is indeterminate, but still advances freshness", async () => {
      await persist("blip.com", { status: "secure", ds: [DS], dnskeys: [] });
      await persist(
        "blip.com",
        { status: "indeterminate", ds: [], dnskeys: [] },
        new Date(Date.now() + 300_000).toISOString(),
      );

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("blip.com");

      // The known-good status/DS survive the blip instead of flipping to
      // indeterminate, and the row isn't stuck stale from the first fetch.
      expect(cached.stale).toBe(false);
      expect(cached.data?.dnssec).toEqual({ status: "secure", ds: [DS], dnskeys: [] });
    });

    it("preserves the stored DS/DNSKEY sets when a later determinate observation's metadata queries failed", async () => {
      await persist("metadata-blip.com", { status: "secure", ds: [DS], dnskeys: [] });
      // Still secure (a real SOA observation), but this round's DS/DNSKEY
      // queries themselves failed — their result is an empty stand-in, not a
      // confirmed-empty observation, and must not erase the stored DS.
      await persist(
        "metadata-blip.com",
        { status: "secure", ds: [], dnskeys: [] },
        undefined,
        false,
        false,
      );

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("metadata-blip.com");

      expect(cached.data?.dnssec).toEqual({ status: "secure", ds: [DS], dnskeys: [] });
    });

    it("does not report a false registry mismatch on a first-ever determinate observation with unavailable DS", async () => {
      // Genuinely never observed before (no prior row), and this round's DS
      // query failed even though SOA still classified the zone as secure.
      // Storing `ds: []` unqualified would be indistinguishable from "the
      // registry says signed, but DNS confirms no DS records" — a bug, not a
      // real mismatch.
      await persist(
        "first-observation-ds-unavailable.com",
        { status: "secure", ds: [], dnskeys: [] },
        undefined,
        false,
        true,
      );
      const { upsertDomain } = await import("@domainstack/db/queries/domains");
      const { upsertRegistration } = await import("@domainstack/db/queries/registrations");
      const domain = await upsertDomain({
        name: "first-observation-ds-unavailable.com",
        tld: "com",
        unicodeName: "first-observation-ds-unavailable.com",
      });
      await upsertRegistration({
        domainId: domain.id,
        isRegistered: true,
        source: "rdap",
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 300_000),
        dnssec: { enabled: true, dsRecords: [DS] },
      });

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("first-observation-ds-unavailable.com");

      // The row exists with the DS-unavailable observation stored — the
      // absent `registry` below must be because of that, not because the
      // whole observation (or the row) is missing.
      expect(cached.data?.dnssec).toEqual({ status: "secure", ds: [], dnskeys: [] });
      expect(cached.data?.dnssec?.registry).toBeUndefined();

      // The next round's DS query succeeds: the row updates and registry
      // comparison resumes normally.
      await persist("first-observation-ds-unavailable.com", {
        status: "secure",
        ds: [DS],
        dnskeys: [],
      });
      const resolved = await getCachedDns("first-observation-ds-unavailable.com");
      expect(resolved.data?.dnssec?.registry).toEqual({ enabled: true, mismatch: false });
    });

    it("flags a first-ever observation's unavailable DNSKEY set instead of presenting it as confirmed-empty", async () => {
      await persist(
        "first-observation-dnskey-unavailable.com",
        { status: "secure", ds: [DS], dnskeys: [] },
        undefined,
        true,
        false,
      );

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("first-observation-dnskey-unavailable.com");

      expect(cached.data?.dnssec?.dnskeysAvailable).toBe(false);

      // The next round's DNSKEY query succeeds: the flag clears.
      const key = { flags: 257, protocol: 3, algorithm: 13, isKsk: true };
      await persist("first-observation-dnskey-unavailable.com", {
        status: "secure",
        ds: [DS],
        dnskeys: [key],
      });
      const resolved = await getCachedDns("first-observation-dnskey-unavailable.com");
      expect(resolved.data?.dnssec?.dnskeysAvailable).toBeUndefined();
      expect(resolved.data?.dnssec?.dnskeys).toEqual([key]);
    });

    it("still updates DS/DNSKEY when their queries succeed, even if the status is unchanged", async () => {
      const otherDs = { keyTag: 9999, algorithm: 13, digestType: 2, digest: "ffff" };
      await persist("rollover.com", { status: "secure", ds: [DS], dnskeys: [] });
      await persist("rollover.com", { status: "secure", ds: [otherDs], dnskeys: [] });

      const { getCachedDns } = await import("@domainstack/db/queries/dns");
      const cached = await getCachedDns("rollover.com");

      expect(cached.data?.dnssec).toEqual({ status: "secure", ds: [otherDs], dnskeys: [] });
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
