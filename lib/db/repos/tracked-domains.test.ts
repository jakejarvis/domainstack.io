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
import { domains, trackedDomains, userLimits, users } from "@/lib/db/schema";
import {
  countTrackedDomainsForUser,
  createTrackedDomain,
  deleteTrackedDomain,
  findTrackedDomain,
  findTrackedDomainById,
  getPendingDomainsForAutoVerification,
  getTrackedDomainsForUser,
  getVerifiedDomainsForReverification,
  markVerificationFailing,
  markVerificationSuccessful,
  revokeVerification,
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
  // Clear tracked domains before each test
  await db.delete(trackedDomains);
});

describe("createTrackedDomain", () => {
  it("creates a new tracked domain record", async () => {
    const result = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token-123",
    });

    expect(result).toBeDefined();
    expect(result.userId).toBe(testUserId);
    expect(result.domainId).toBe(testDomainId);
    expect(result.verificationToken).toBe("test-token-123");
    expect(result.verified).toBe(false);
    expect(result.verificationStatusEnum).toBe("unverified");
  });

  it("creates with verification method if provided", async () => {
    const result = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token-456",
      verificationMethod: "dns_txt",
    });

    expect(result.verificationMethod).toBe("dns_txt");
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

    const result = await findTrackedDomainById(created.id);
    expect(result).toBeDefined();
    expect(result?.id).toBe(created.id);
  });
});

describe("verifyTrackedDomain", () => {
  it("marks domain as verified with correct status", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const result = await verifyTrackedDomain(created.id, "dns_txt");

    expect(result.verified).toBe(true);
    expect(result.verificationMethod).toBe("dns_txt");
    expect(result.verificationStatusEnum).toBe("verified");
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

    // First verify the domain
    await verifyTrackedDomain(created.id, "dns_txt");

    // Then mark as failing
    await markVerificationFailing(created.id);

    // Now mark as successful
    const result = await markVerificationSuccessful(created.id);

    expect(result.verificationStatusEnum).toBe("verified");
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
    await verifyTrackedDomain(created.id, "dns_txt");

    const result = await markVerificationFailing(created.id);

    expect(result?.verificationStatusEnum).toBe("failing");
    expect(result?.verificationFailedAt).toBeInstanceOf(Date);
  });

  it("does not overwrite existing failure time on subsequent calls", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    await verifyTrackedDomain(created.id, "dns_txt");

    // First failure
    const first = await markVerificationFailing(created.id);
    const firstFailedAt = first?.verificationFailedAt;

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second failure - should keep original time
    const second = await markVerificationFailing(created.id);

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
    await verifyTrackedDomain(created.id, "dns_txt");

    const result = await revokeVerification(created.id);

    expect(result.verified).toBe(false);
    expect(result.verificationStatusEnum).toBe("unverified");
    expect(result.verificationFailedAt).toBeNull();
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

    const result = await deleteTrackedDomain(created.id);
    expect(result).toBe(true);

    const found = await findTrackedDomainById(created.id);
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
      notifyDomainExpiry: true,
      notifyVerificationFailing: true,
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
    await verifyTrackedDomain(created.id, "dns_txt");

    const result = await getVerifiedDomainsForReverification();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: created.id,
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
    await verifyTrackedDomain(created.id, "dns_txt");

    const result = await getPendingDomainsForAutoVerification();
    expect(result).toEqual([]);
  });
});
