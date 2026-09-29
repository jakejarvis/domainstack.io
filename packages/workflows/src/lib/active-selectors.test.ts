/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

const { domains, domainSnapshots, users, userTrackedDomains } =
  await import("@domainstack/db/schema");
const { getVerifiedTrackedDomainIds } = await import("@domainstack/db/queries/tracked-domains");
const { getMonitoredSnapshotIds, getVerifiedDomainsWithoutSnapshots } =
  await import("@domainstack/db/queries/snapshots");

const USER_ID = "active-selectors-user";

const ACTIVE_DOMAIN_ID = "a0000000-0000-1000-a000-000000000101";
const ACTIVE_TRACKED_ID = "b0000000-0000-1000-a000-000000000101";
const ARCHIVED_DOMAIN_ID = "a0000000-0000-1000-a000-000000000102";
const ARCHIVED_TRACKED_ID = "b0000000-0000-1000-a000-000000000102";
const UNVERIFIED_DOMAIN_ID = "a0000000-0000-1000-a000-000000000103";
const UNVERIFIED_TRACKED_ID = "b0000000-0000-1000-a000-000000000103";
const SNAPSHOTTED_DOMAIN_ID = "a0000000-0000-1000-a000-000000000104";
const SNAPSHOTTED_TRACKED_ID = "b0000000-0000-1000-a000-000000000104";

beforeAll(async () => {
  await db.insert(users).values({
    id: USER_ID,
    name: "Selector User",
    email: "selectors@example.com",
    emailVerified: true,
  });

  await db.insert(domains).values([
    { id: ACTIVE_DOMAIN_ID, name: "active.com", tld: "com", unicodeName: "active.com" },
    { id: ARCHIVED_DOMAIN_ID, name: "archived.com", tld: "com", unicodeName: "archived.com" },
    {
      id: UNVERIFIED_DOMAIN_ID,
      name: "unverified.com",
      tld: "com",
      unicodeName: "unverified.com",
    },
    {
      id: SNAPSHOTTED_DOMAIN_ID,
      name: "snapshotted.com",
      tld: "com",
      unicodeName: "snapshotted.com",
    },
  ]);

  await db.insert(userTrackedDomains).values([
    {
      id: ACTIVE_TRACKED_ID,
      userId: USER_ID,
      domainId: ACTIVE_DOMAIN_ID,
      verified: true,
      verificationToken: "token-active",
    },
    {
      id: ARCHIVED_TRACKED_ID,
      userId: USER_ID,
      domainId: ARCHIVED_DOMAIN_ID,
      verified: true,
      verificationToken: "token-archived",
      archivedAt: new Date(),
    },
    {
      id: UNVERIFIED_TRACKED_ID,
      userId: USER_ID,
      domainId: UNVERIFIED_DOMAIN_ID,
      verified: false,
      verificationToken: "token-unverified",
    },
    {
      id: SNAPSHOTTED_TRACKED_ID,
      userId: USER_ID,
      domainId: SNAPSHOTTED_DOMAIN_ID,
      verified: true,
      verificationToken: "token-snapshotted",
    },
  ]);

  // Snapshots for the snapshotted-active, archived, and unverified domains, so the
  // join-based selectors must filter on eligibility rather than snapshot presence.
  await db
    .insert(domainSnapshots)
    .values([
      { trackedDomainId: SNAPSHOTTED_TRACKED_ID },
      { trackedDomainId: ARCHIVED_TRACKED_ID },
      { trackedDomainId: UNVERIFIED_TRACKED_ID },
    ]);
});

afterAll(async () => {
  await closePGliteDb();
});

describe("active tracked domain selectors", () => {
  it("getVerifiedTrackedDomainIds returns only verified, non-archived ids", async () => {
    const ids = await getVerifiedTrackedDomainIds();

    expect([...ids].sort()).toEqual([ACTIVE_TRACKED_ID, SNAPSHOTTED_TRACKED_ID].sort());
  });

  it("getMonitoredSnapshotIds returns only active domains that have a snapshot", async () => {
    const ids = await getMonitoredSnapshotIds();

    expect(ids).toEqual([SNAPSHOTTED_TRACKED_ID]);
  });

  it("getVerifiedDomainsWithoutSnapshots returns only active domains without a snapshot", async () => {
    const rows = await getVerifiedDomainsWithoutSnapshots();

    expect(rows).toEqual([{ trackedDomainId: ACTIVE_TRACKED_ID, domainId: ACTIVE_DOMAIN_ID }]);
  });
});
