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
    .values({
      id: TEST_DOMAIN_ID,
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    })
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
    .values({
      id: TEST_TRACKED_ID,
      userId: TEST_USER_ID,
      domainId: TEST_DOMAIN_ID,
      verified: true,
      verificationToken: "test-token",
    })
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
});
