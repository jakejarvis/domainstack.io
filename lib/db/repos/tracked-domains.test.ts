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
import {
  domains,
  providers,
  registrations,
  trackedDomains,
  userLimits,
  users,
} from "@/lib/db/schema";
import {
  countTrackedDomainsForUser,
  createTrackedDomain,
  deleteTrackedDomain,
  findTrackedDomain,
  findTrackedDomainById,
  findTrackedDomainWithDomainName,
  getPendingDomainsForAutoVerification,
  getTrackedDomainsForUser,
  getVerifiedDomainsForReverification,
  getVerifiedTrackedDomainsWithExpiry,
  markVerificationFailing,
  markVerificationSuccessful,
  resetNotificationOverrides,
  revokeVerification,
  updateNotificationOverrides,
  verifyTrackedDomain,
} from "./tracked-domains";

let testUserId: string;
let testDomainId: string;

beforeAll(async () => {
  // Create a test user
  const insertedUser = await db
    .insert(users)
    .values({
      id: "test-user-123",
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
    })
    .returning();
  testUserId = insertedUser[0].id;

  // Create user limits
  await db.insert(userLimits).values({
    userId: testUserId,
    tier: "free",
    maxDomainsOverride: null,
  });

  // Create a test domain
  const insertedDomain = await db
    .insert(domains)
    .values({
      name: "example.com",
      tld: "com",
      unicodeName: "example.com",
    })
    .returning();
  testDomainId = insertedDomain[0].id;
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

beforeEach(async () => {
  // Clear test data before each test (order matters due to FK constraints)
  await db.delete(trackedDomains);
  await db.delete(registrations);
  await db.delete(providers);
});

describe("createTrackedDomain", () => {
  it("creates a new tracked domain record", async () => {
    const result = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token-123",
    });

    expect(result).not.toBeNull();
    expect(result?.userId).toBe(testUserId);
    expect(result?.domainId).toBe(testDomainId);
    expect(result?.verificationToken).toBe("test-token-123");
    expect(result?.verified).toBe(false);
    expect(result?.verificationStatus).toBe("unverified");
  });

  it("creates with verification method if provided", async () => {
    const result = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token-456",
      verificationMethod: "dns_txt",
    });

    expect(result).not.toBeNull();
    expect(result?.verificationMethod).toBe("dns_txt");
  });
});

describe("findTrackedDomain", () => {
  it("returns null when domain is not tracked", async () => {
    const result = await findTrackedDomain(testUserId, testDomainId);
    expect(result).toBeNull();
  });

  it("returns tracked domain when it exists", async () => {
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const result = await findTrackedDomain(testUserId, testDomainId);
    expect(result).toBeDefined();
    expect(result?.userId).toBe(testUserId);
    expect(result?.domainId).toBe(testDomainId);
  });
});

describe("findTrackedDomainById", () => {
  it("returns null when ID does not exist", async () => {
    const result = await findTrackedDomainById(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBeNull();
  });

  it("returns tracked domain by ID", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    const result = await findTrackedDomainById(createdId);
    expect(result).toBeDefined();
    expect(result?.id).toBe(createdId);
  });
});

describe("verifyTrackedDomain", () => {
  it("marks domain as verified with correct status", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    const result = await verifyTrackedDomain(createdId, "dns_txt");

    expect(result.verified).toBe(true);
    expect(result.verificationMethod).toBe("dns_txt");
    expect(result.verificationStatus).toBe("verified");
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(result.lastVerifiedAt).toBeInstanceOf(Date);
    expect(result.verificationFailedAt).toBeNull();
  });
});

describe("markVerificationSuccessful", () => {
  it("updates lastVerifiedAt and clears failing status", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    // First verify the domain
    await verifyTrackedDomain(createdId, "dns_txt");

    // Then mark as failing
    await markVerificationFailing(createdId);

    // Now mark as successful
    const result = await markVerificationSuccessful(createdId);

    expect(result.verificationStatus).toBe("verified");
    expect(result.verificationFailedAt).toBeNull();
    expect(result.lastVerifiedAt).toBeInstanceOf(Date);
  });
});

describe("markVerificationFailing", () => {
  it("sets status to failing and records failure time", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;
    await verifyTrackedDomain(createdId, "dns_txt");

    const result = await markVerificationFailing(createdId);

    expect(result?.verificationStatus).toBe("failing");
    expect(result?.verificationFailedAt).toBeInstanceOf(Date);
  });

  it("does not overwrite existing failure time on subsequent calls", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;
    await verifyTrackedDomain(createdId, "dns_txt");

    // First failure
    const first = await markVerificationFailing(createdId);
    const firstFailedAt = first?.verificationFailedAt;

    // Second failure - should keep original time
    const second = await markVerificationFailing(createdId);

    expect(second?.verificationFailedAt?.getTime()).toBe(
      firstFailedAt?.getTime(),
    );
  });
});

describe("revokeVerification", () => {
  it("sets verified to false and status to unverified", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;
    await verifyTrackedDomain(createdId, "dns_txt");

    const result = await revokeVerification(createdId);
    expect(result).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(result).not.toBeNull()
    const revokedDomain = result!;

    expect(revokedDomain.verified).toBe(false);
    expect(revokedDomain.verificationStatus).toBe("unverified");
    expect(revokedDomain.verificationFailedAt).toBeNull();
  });
});

describe("countTrackedDomainsForUser", () => {
  it("returns 0 when user has no tracked domains", async () => {
    const count = await countTrackedDomainsForUser(testUserId);
    expect(count).toBe(0);
  });

  it("returns correct count of tracked domains", async () => {
    // Create a second domain for this test
    const domain2 = await db
      .insert(domains)
      .values({
        name: "test2.com",
        tld: "com",
        unicodeName: "test2.com",
      })
      .returning();

    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "token1",
    });
    await createTrackedDomain({
      userId: testUserId,
      domainId: domain2[0].id,
      verificationToken: "token2",
    });

    const count = await countTrackedDomainsForUser(testUserId);
    expect(count).toBe(2);
  });
});

describe("deleteTrackedDomain", () => {
  it("returns true and deletes the domain", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    const result = await deleteTrackedDomain(createdId);
    expect(result).toBe(true);

    const found = await findTrackedDomainById(createdId);
    expect(found).toBeNull();
  });

  it("returns true even for non-existent ID (no-op)", async () => {
    const result = await deleteTrackedDomain(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBe(true);
  });
});

describe("getTrackedDomainsForUser", () => {
  it("returns empty array when user has no domains", async () => {
    const result = await getTrackedDomainsForUser(testUserId);
    expect(result).toEqual([]);
  });

  it("returns domains with all expected fields", async () => {
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const result = await getTrackedDomainsForUser(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: testUserId,
      domainId: testDomainId,
      domainName: "example.com",
      verified: false,
      verificationToken: "test-token",
      verificationStatus: "unverified",
      notificationOverrides: {},
    });
    expect(result[0].registrar).toEqual({ name: null, domain: null });
    expect(result[0].dns).toEqual({ name: null, domain: null });
    expect(result[0].hosting).toEqual({ name: null, domain: null });
    expect(result[0].email).toEqual({ name: null, domain: null });
  });
});

describe("getVerifiedDomainsForReverification", () => {
  it("returns empty array when no verified domains", async () => {
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const result = await getVerifiedDomainsForReverification();
    expect(result).toEqual([]);
  });

  it("returns only verified domains with verification method", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;
    await verifyTrackedDomain(createdId, "dns_txt");

    const result = await getVerifiedDomainsForReverification();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: createdId,
      userId: testUserId,
      domainName: "example.com",
      verificationToken: "test-token",
      verificationMethod: "dns_txt",
      verificationStatus: "verified",
    });
  });
});

describe("getPendingDomainsForAutoVerification", () => {
  it("returns unverified domains", async () => {
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const result = await getPendingDomainsForAutoVerification();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: testUserId,
      domainName: "example.com",
      verificationToken: "test-token",
    });
  });

  it("excludes verified domains", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;
    await verifyTrackedDomain(createdId, "dns_txt");

    const result = await getPendingDomainsForAutoVerification();
    expect(result).toEqual([]);
  });
});

describe("findTrackedDomainWithDomainName", () => {
  it("returns null when ID does not exist", async () => {
    const result = await findTrackedDomainWithDomainName(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBeNull();
  });

  it("returns tracked domain with domain name", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    const result = await findTrackedDomainWithDomainName(createdId);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(createdId);
    expect(result?.userId).toBe(testUserId);
    expect(result?.domainName).toBe("example.com");
    expect(result?.verificationToken).toBe("test-token");
  });
});

describe("updateNotificationOverrides", () => {
  it("updates notification overrides for a domain", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    const result = await updateNotificationOverrides(createdId, {
      domainExpiry: false,
    });

    expect(result).not.toBeNull();
    expect(result?.notificationOverrides).toEqual({ domainExpiry: false });
  });

  it("merges overrides with existing values", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    // Set first override
    await updateNotificationOverrides(createdId, {
      domainExpiry: false,
    });

    // Set second override
    const result = await updateNotificationOverrides(createdId, {
      certificateExpiry: true,
    });

    expect(result?.notificationOverrides).toEqual({
      domainExpiry: false,
      certificateExpiry: true,
    });
  });

  it("returns null for non-existent domain", async () => {
    const result = await updateNotificationOverrides(
      "00000000-0000-0000-0000-000000000000",
      { domainExpiry: false },
    );
    expect(result).toBeNull();
  });
});

describe("resetNotificationOverrides", () => {
  it("resets all notification overrides to empty object", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    // Set some overrides first
    await updateNotificationOverrides(createdId, {
      domainExpiry: false,
      certificateExpiry: true,
    });

    // Reset
    const result = await resetNotificationOverrides(createdId);

    expect(result).not.toBeNull();
    expect(result?.notificationOverrides).toEqual({});
  });

  it("returns null for non-existent domain", async () => {
    const result = await resetNotificationOverrides(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBeNull();
  });
});

describe("getVerifiedTrackedDomainsWithExpiry", () => {
  it("returns empty array when no verified domains with registration data", async () => {
    // Create unverified domain
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const result = await getVerifiedTrackedDomainsWithExpiry();
    expect(result).toEqual([]);
  });

  it("excludes unverified domains", async () => {
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const result = await getVerifiedTrackedDomainsWithExpiry();
    expect(result).toEqual([]);
  });

  it("returns full structure with registration data and registrar", async () => {
    // Create a registrar provider
    const [registrar] = await db
      .insert(providers)
      .values({
        category: "registrar",
        name: "Test Registrar Inc",
        slug: "test-registrar",
        source: "catalog",
      })
      .returning();

    // Create registration data with expiration date
    const expirationDate = new Date("2025-12-31T00:00:00Z");
    await db.insert(registrations).values({
      domainId: testDomainId,
      isRegistered: true,
      expirationDate,
      registrarProviderId: registrar.id,
      source: "rdap",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000), // 1 day from now
    });

    // Create and verify tracked domain
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;
    await verifyTrackedDomain(createdId, "dns_txt");

    const result = await getVerifiedTrackedDomainsWithExpiry();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: createdId,
      userId: testUserId,
      domainId: testDomainId,
      domainName: "example.com",
      notificationOverrides: {},
      registrar: "Test Registrar Inc",
      userEmail: "test@example.com",
      userName: "Test User",
    });
    // Check expiration date separately due to Date comparison
    expect(result[0].expirationDate).toEqual(expirationDate);
  });

  it("returns null registrar when no provider linked", async () => {
    // Create registration data without registrar
    const expirationDate = new Date("2026-06-15T00:00:00Z");
    await db.insert(registrations).values({
      domainId: testDomainId,
      isRegistered: true,
      expirationDate,
      registrarProviderId: null,
      source: "whois",
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    // Create and verify tracked domain
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;
    await verifyTrackedDomain(createdId, "html_file");

    const result = await getVerifiedTrackedDomainsWithExpiry();

    expect(result).toHaveLength(1);
    expect(result[0].registrar).toBeNull();
    expect(result[0].expirationDate).toEqual(expirationDate);
  });
});
