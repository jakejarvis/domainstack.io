/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

const { domains, domainSnapshots, providers, users, userTrackedDomains } =
  await import("@domainstack/db/schema");
const { eq } = await import("@domainstack/db/drizzle");
const { createSnapshot } = await import("@domainstack/db/queries/snapshots");

const TEST_USER_ID = "test-user-id-12345";
const TEST_DOMAIN_ID = "a0000000-0000-1000-a000-000000000001";
const TEST_TRACKED_ID = "b0000000-0000-1000-a000-000000000010";
const ARCHIVED_DOMAIN_ID = "a0000000-0000-1000-a000-000000000002";
const ARCHIVED_TRACKED_ID = "b0000000-0000-1000-a000-000000000011";
const UNVERIFIED_DOMAIN_ID = "a0000000-0000-1000-a000-000000000003";
const UNVERIFIED_TRACKED_ID = "b0000000-0000-1000-a000-000000000012";
const FRESH_DOMAIN_ID = "a0000000-0000-1000-a000-000000000004";
const FRESH_TRACKED_ID = "b0000000-0000-1000-a000-000000000013";
const MISSING_TRACKED_ID = "b0000000-0000-1000-a000-0000000000ff";
const TEST_PROVIDER_ID = "c0000000-0000-1000-a000-000000000020";
const TEST_PROVIDER_2_ID = "c0000000-0000-1000-a000-000000000021";

beforeAll(async () => {
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
    })
    .onConflictDoNothing();

  await db
    .insert(domains)
    .values([
      { id: TEST_DOMAIN_ID, name: "example.com", tld: "com", unicodeName: "example.com" },
      { id: ARCHIVED_DOMAIN_ID, name: "archived.com", tld: "com", unicodeName: "archived.com" },
      {
        id: UNVERIFIED_DOMAIN_ID,
        name: "unverified.com",
        tld: "com",
        unicodeName: "unverified.com",
      },
      { id: FRESH_DOMAIN_ID, name: "fresh.com", tld: "com", unicodeName: "fresh.com" },
    ])
    .onConflictDoNothing();

  await db
    .insert(providers)
    .values([
      {
        id: TEST_PROVIDER_ID,
        category: "dns",
        name: "DNS Co",
        slug: "dns-co",
      },
      {
        id: TEST_PROVIDER_2_ID,
        category: "dns",
        name: "Other DNS Co",
        slug: "other-dns-co",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(userTrackedDomains)
    .values([
      {
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verified: true,
        verificationToken: "test-token",
      },
      {
        id: ARCHIVED_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: ARCHIVED_DOMAIN_ID,
        verified: true,
        verificationToken: "test-token-archived",
        archivedAt: new Date(),
      },
      {
        id: UNVERIFIED_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: UNVERIFIED_DOMAIN_ID,
        verified: false,
        verificationToken: "test-token-unverified",
      },
      {
        id: FRESH_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: FRESH_DOMAIN_ID,
        verified: true,
        verificationToken: "test-token-fresh",
      },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await closePGliteDb();
});

describe("createSnapshot", () => {
  it("creates a baseline snapshot on first call", async () => {
    const snapshot = await createSnapshot({
      trackedDomainId: TEST_TRACKED_ID,
      registration: {
        registrarProviderId: null,
        nameservers: [{ host: "ns1.example.com" }],
        transferLock: null,
        statuses: [],
      },
      dnsProviderId: TEST_PROVIDER_ID,
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.dnsProviderId).toBe(TEST_PROVIDER_ID);
    expect(snapshot?.registration.nameservers).toEqual([{ host: "ns1.example.com" }]);
  });

  it("does not overwrite an existing snapshot", async () => {
    const result = await createSnapshot({
      trackedDomainId: TEST_TRACKED_ID,
      registration: {
        registrarProviderId: null,
        nameservers: [{ host: "ns2.example.com" }],
        transferLock: null,
        statuses: [],
      },
      dnsProviderId: TEST_PROVIDER_2_ID,
    });

    expect(result).toBeNull();

    const [row] = await db
      .select()
      .from(domainSnapshots)
      .where(eq(domainSnapshots.trackedDomainId, TEST_TRACKED_ID));

    expect(row?.dnsProviderId).toBe(TEST_PROVIDER_ID);
    expect(row?.registration.nameservers).toEqual([{ host: "ns1.example.com" }]);
  });

  it("stores empty snapshot data and null provider ids when only the tracked domain is given", async () => {
    const snapshot = await createSnapshot({ trackedDomainId: FRESH_TRACKED_ID });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.trackedDomainId).toBe(FRESH_TRACKED_ID);
    expect(snapshot?.registration).toEqual({
      registrarProviderId: null,
      nameservers: [],
      transferLock: null,
      statuses: [],
    });
    expect(snapshot?.certificate).toEqual({
      caProviderId: null,
      issuer: "",
      validTo: "",
      fingerprint: null,
      serialNumber: null,
    });
    expect(snapshot?.dnsProviderId).toBeNull();
    expect(snapshot?.hostingProviderId).toBeNull();
    expect(snapshot?.emailProviderId).toBeNull();
    expect(snapshot?.providerPending).toBeNull();
    expect(snapshot?.id).toEqual(expect.any(String));
    expect(snapshot?.createdAt).toBeInstanceOf(Date);
    expect(snapshot?.updatedAt).toBeInstanceOf(Date);
  });

  it("returns null and writes nothing for an archived tracked domain", async () => {
    const result = await createSnapshot({ trackedDomainId: ARCHIVED_TRACKED_ID });

    expect(result).toBeNull();
    const rows = await db
      .select()
      .from(domainSnapshots)
      .where(eq(domainSnapshots.trackedDomainId, ARCHIVED_TRACKED_ID));
    expect(rows).toHaveLength(0);
  });

  it("returns null and writes nothing for an unverified tracked domain", async () => {
    const result = await createSnapshot({ trackedDomainId: UNVERIFIED_TRACKED_ID });

    expect(result).toBeNull();
    const rows = await db
      .select()
      .from(domainSnapshots)
      .where(eq(domainSnapshots.trackedDomainId, UNVERIFIED_TRACKED_ID));
    expect(rows).toHaveLength(0);
  });

  it("returns null instead of violating the foreign key for a missing tracked domain", async () => {
    const result = await createSnapshot({ trackedDomainId: MISSING_TRACKED_ID });

    expect(result).toBeNull();
  });

  it("creates the baseline once a domain becomes eligible again", async () => {
    await db
      .update(userTrackedDomains)
      .set({ archivedAt: null })
      .where(eq(userTrackedDomains.id, ARCHIVED_TRACKED_ID));

    const snapshot = await createSnapshot({ trackedDomainId: ARCHIVED_TRACKED_ID });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.trackedDomainId).toBe(ARCHIVED_TRACKED_ID);
  });
});
