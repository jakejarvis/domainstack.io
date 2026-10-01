/* @vitest-environment node */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb, resetPGliteDb } = await import("@domainstack/db/testing");
await makePGliteDb();

const { db } = await import("@domainstack/db/client");
const { getEarliestCertificate } = await import("@domainstack/db/queries/certificates");
const { certificateChecks, certificates, domains, userTrackedDomains, users } =
  await import("@domainstack/db/schema");

const FETCHED_AT = new Date("2026-01-01T00:00:00.000Z");
const CHECK_EXPIRES_AT = new Date("2026-01-01T06:00:00.000Z");
const VALID_FROM = new Date("2025-12-01T00:00:00.000Z");
const LEAF_VALID_TO = new Date("2027-01-01T00:00:00.000Z");
const INTERMEDIATE_VALID_TO = new Date("2026-06-01T00:00:00.000Z");

interface SeedOptions {
  verified?: boolean;
  archivedAt?: Date | null;
  muted?: boolean;
}

/** Insert a user, a domain, and a tracked-domain row; returns their ids. */
async function seedTrackedDomain({
  verified = true,
  archivedAt = null,
  muted = false,
}: SeedOptions = {}) {
  await db.insert(users).values({ id: "user-1", name: "Alex", email: "alex@example.com" });
  const [domain] = await db
    .insert(domains)
    .values({ name: "example.com", tld: "com", unicodeName: "example.com" })
    .returning({ id: domains.id });
  if (!domain) throw new Error("domain insert returned no row");
  const [tracked] = await db
    .insert(userTrackedDomains)
    .values({
      userId: "user-1",
      domainId: domain.id,
      verified,
      archivedAt,
      muted,
      verificationToken: "token",
    })
    .returning({ id: userTrackedDomains.id });
  if (!tracked) throw new Error("tracked domain insert returned no row");
  return { domainId: domain.id, trackedDomainId: tracked.id };
}

async function insertCertificate(
  domainId: string,
  chainPosition: number | null,
  overrides: Partial<typeof certificates.$inferInsert> = {},
) {
  await db.insert(certificates).values({
    domainId,
    issuer: "CN=Some CA",
    subject: "CN=example.com",
    validFrom: VALID_FROM,
    validTo: LEAF_VALID_TO,
    fingerprint256: `fp-${chainPosition ?? "legacy"}`,
    serialNumber: `sn-${chainPosition ?? "legacy"}`,
    fetchedAt: FETCHED_AT,
    expiresAt: CHECK_EXPIRES_AT,
    chainPosition,
    ...overrides,
  });
}

async function insertCheck(domainId: string) {
  await db.insert(certificateChecks).values({
    domainId,
    valid: true,
    chainComplete: true,
    fetchedAt: FETCHED_AT,
    expiresAt: CHECK_EXPIRES_AT,
  });
}

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  await resetPGliteDb();
  // resetPGliteDb clears domains (and the tracked domains that cascade from them)
  // but not users.
  await db.delete(users);
});

describe("getEarliestCertificate", () => {
  it("returns the leaf, not the earliest-expiring certificate in the chain", async () => {
    const { domainId, trackedDomainId } = await seedTrackedDomain();
    await insertCertificate(domainId, 1, {
      issuer: "CN=Intermediate CA",
      validTo: INTERMEDIATE_VALID_TO,
    });
    await insertCertificate(domainId, 0, { issuer: "CN=Leaf CA", validTo: LEAF_VALID_TO });

    const result = await getEarliestCertificate(trackedDomainId);

    expect(result).toMatchObject({
      trackedDomainId,
      userId: "user-1",
      domainId,
      domainName: "example.com",
      muted: false,
      issuer: "CN=Leaf CA",
      validFrom: VALID_FROM,
      validTo: LEAF_VALID_TO,
      userEmail: "alex@example.com",
      userName: "Alex",
    });
  });

  it("returns a legacy certificate that has no chain position", async () => {
    const { domainId, trackedDomainId } = await seedTrackedDomain();
    await insertCertificate(domainId, null, { issuer: "CN=Legacy CA" });

    const result = await getEarliestCertificate(trackedDomainId);

    expect(result).toMatchObject({ trackedDomainId, issuer: "CN=Legacy CA" });
  });

  it("still returns the certificate, with null freshness, when there is no check row", async () => {
    const { domainId, trackedDomainId } = await seedTrackedDomain();
    await insertCertificate(domainId, 0);

    const result = await getEarliestCertificate(trackedDomainId);

    expect(result).not.toBeNull();
    expect(result?.checkFetchedAt).toBeNull();
    expect(result?.checkExpiresAt).toBeNull();
  });

  it("carries the freshness window from the check row", async () => {
    const { domainId, trackedDomainId } = await seedTrackedDomain();
    await insertCertificate(domainId, 0);
    await insertCheck(domainId);

    const result = await getEarliestCertificate(trackedDomainId);

    expect(result?.checkFetchedAt).toEqual(FETCHED_AT);
    expect(result?.checkExpiresAt).toEqual(CHECK_EXPIRES_AT);
  });

  it("returns null when the tracked domain is archived", async () => {
    const { domainId, trackedDomainId } = await seedTrackedDomain({
      archivedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    await insertCertificate(domainId, 0);
    await insertCheck(domainId);

    expect(await getEarliestCertificate(trackedDomainId)).toBeNull();
  });

  it("returns null when the tracked domain is not verified", async () => {
    const { domainId, trackedDomainId } = await seedTrackedDomain({ verified: false });
    await insertCertificate(domainId, 0);
    await insertCheck(domainId);

    expect(await getEarliestCertificate(trackedDomainId)).toBeNull();
  });
});
