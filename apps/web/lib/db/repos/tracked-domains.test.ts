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

import { ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  domains,
  providers,
  registrations,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import {
  archiveOldestActiveDomains,
  archiveTrackedDomain,
  countActiveTrackedDomainsForUser,
  countArchivedTrackedDomainsForUser,
  countTrackedDomainsForUser,
  createTrackedDomain,
  deleteTrackedDomain,
  findTrackedDomain,
  findTrackedDomainById,
  findTrackedDomainWithDomainName,
  getArchivedDomainsForUser,
  getTrackedDomainsForUser,
  markVerificationFailing,
  markVerificationSuccessful,
  revokeVerification,
  setDomainMuted,
  unarchiveTrackedDomain,
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
      email: "test@example.test",
      emailVerified: true,
    })
    .returning();
  testUserId = insertedUser[0].id;

  // Create a test domain
  const insertedDomain = await db
    .insert(domains)
    .values({
      name: "example.test",
      tld: "test",
      unicodeName: "example.test",
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
  await db.delete(userTrackedDomains);
  await db.delete(registrations);
  await db.delete(providers);
  // Clean up domains created mid-test, but preserve the main test domain
  await db.delete(domains).where(ne(domains.id, testDomainId));
});

describe("createTrackedDomain", () => {
  it("creates a new tracked domain record", async () => {
    const result = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token-123",
    });

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected result");

    expect(result.userId).toBe(testUserId);
    expect(result.domainId).toBe(testDomainId);
    expect(result.verificationToken).toBe("test-token-123");
    expect(result.verified).toBe(false);
    expect(result.verificationStatus).toBe("unverified");
  });

  it("creates with verification method if provided", async () => {
    const result = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token-456",
      verificationMethod: "dns_txt",
    });

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected result");

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
    if (!result) throw new Error("Expected result");

    expect(result.userId).toBe(testUserId);
    expect(result.domainId).toBe(testDomainId);
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
    if (!result) throw new Error("Expected result");

    expect(result.id).toBe(createdId);
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
    expect(result).toBeDefined();
    if (!result) throw new Error("Expected result");

    expect(result.verificationStatus).toBe("failing");
    expect(result.verificationFailedAt).toBeInstanceOf(Date);
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
        name: "test2.test",
        tld: "test",
        unicodeName: "test2.test",
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
      domainName: "example.test",
      verified: false,
      verificationToken: "test-token",
      verificationStatus: "unverified",
      muted: false,
    });
    expect(result[0].registrar).toEqual({
      id: null,
      name: null,
      domain: null,
      whoisServer: null,
      rdapServers: null,
      registrationSource: null,
      transferLock: null,
      registrantInfo: {
        privacyEnabled: null,
        contacts: null,
      },
    });
    expect(result[0].dns).toEqual({ id: null, name: null, domain: null });
    expect(result[0].hosting).toEqual({ id: null, name: null, domain: null });
    expect(result[0].email).toEqual({ id: null, name: null, domain: null });
    expect(result[0].ca).toEqual({
      id: null,
      name: null,
      domain: null,
      certificateExpiryDate: null,
    });
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
    if (!result) throw new Error("Expected result");

    expect(result.id).toBe(createdId);
    expect(result.userId).toBe(testUserId);
    expect(result.domainName).toBe("example.test");
    expect(result.verificationToken).toBe("test-token");
  });
});

describe("setDomainMuted", () => {
  it("sets muted to true", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    const result = await setDomainMuted(createdId, true);

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected result");

    expect(result.muted).toBe(true);
  });

  it("sets muted to false (unmute)", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    // First mute
    await setDomainMuted(createdId, true);

    // Then unmute
    const result = await setDomainMuted(createdId, false);

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected result");

    expect(result.muted).toBe(false);
  });

  it("returns null for non-existent domain", async () => {
    const result = await setDomainMuted(
      "00000000-0000-0000-0000-000000000000",
      true,
    );
    expect(result).toBeNull();
  });
});

// Archive/Unarchive Tests
describe("archiveTrackedDomain", () => {
  it("sets archivedAt timestamp on the domain", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    const result = await archiveTrackedDomain(createdId);

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected result");

    expect(result.archivedAt).toBeInstanceOf(Date);
  });

  it("returns null for non-existent ID", async () => {
    const result = await archiveTrackedDomain(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBeNull();
  });
});

describe("unarchiveTrackedDomain", () => {
  it("clears archivedAt timestamp on the domain", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    // Archive first
    await archiveTrackedDomain(createdId);

    // Then unarchive
    const result = await unarchiveTrackedDomain(createdId);

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected result");

    expect(result.archivedAt).toBeNull();
  });

  it("returns null for non-existent ID", async () => {
    const result = await unarchiveTrackedDomain(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBeNull();
  });
});

describe("countActiveTrackedDomainsForUser", () => {
  it("returns 0 when user has no domains", async () => {
    const count = await countActiveTrackedDomainsForUser(testUserId);
    expect(count).toBe(0);
  });

  it("counts only non-archived domains", async () => {
    // Create two domains
    const domain2 = await db
      .insert(domains)
      .values({
        name: "archive.test",
        tld: "test",
        unicodeName: "archive.test",
      })
      .returning();

    const created1 = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "token1",
    });
    await createTrackedDomain({
      userId: testUserId,
      domainId: domain2[0].id,
      verificationToken: "token2",
    });

    // Archive first domain
    // biome-ignore lint/style/noNonNullAssertion: safe after createTrackedDomain
    await archiveTrackedDomain(created1!.id);

    const count = await countActiveTrackedDomainsForUser(testUserId);
    expect(count).toBe(1);
  });
});

describe("countArchivedTrackedDomainsForUser", () => {
  it("returns 0 when user has no archived domains", async () => {
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const count = await countArchivedTrackedDomainsForUser(testUserId);
    expect(count).toBe(0);
  });

  it("counts only archived domains", async () => {
    // Create two domains
    const domain2 = await db
      .insert(domains)
      .values({
        name: "archive2.test",
        tld: "test",
        unicodeName: "archive2.test",
      })
      .returning();

    const created1 = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "token1",
    });
    await createTrackedDomain({
      userId: testUserId,
      domainId: domain2[0].id,
      verificationToken: "token2",
    });

    // Archive first domain
    // biome-ignore lint/style/noNonNullAssertion: safe after createTrackedDomain
    await archiveTrackedDomain(created1!.id);

    const count = await countArchivedTrackedDomainsForUser(testUserId);
    expect(count).toBe(1);
  });
});

describe("archiveOldestActiveDomains", () => {
  it("returns 0 when count is 0 or negative", async () => {
    const result = await archiveOldestActiveDomains(testUserId, 0);
    expect(result).toBe(0);

    const result2 = await archiveOldestActiveDomains(testUserId, -5);
    expect(result2).toBe(0);
  });

  it("returns 0 when user has no active domains", async () => {
    const result = await archiveOldestActiveDomains(testUserId, 5);
    expect(result).toBe(0);
  });

  it("archives the specified number of oldest domains", async () => {
    // Create multiple domains
    const domain2 = await db
      .insert(domains)
      .values({
        name: "oldest.test",
        tld: "test",
        unicodeName: "oldest.test",
      })
      .returning();

    const domain3 = await db
      .insert(domains)
      .values({
        name: "newest.test",
        tld: "test",
        unicodeName: "newest.test",
      })
      .returning();

    // Create tracked domains (order matters for "oldest")
    await createTrackedDomain({
      userId: testUserId,
      domainId: domain2[0].id, // oldest
      verificationToken: "token1",
    });
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId, // middle
      verificationToken: "token2",
    });
    await createTrackedDomain({
      userId: testUserId,
      domainId: domain3[0].id, // newest
      verificationToken: "token3",
    });

    // Archive 2 oldest
    const archived = await archiveOldestActiveDomains(testUserId, 2);
    expect(archived).toBe(2);

    // Should have 1 active domain remaining
    const activeCount = await countActiveTrackedDomainsForUser(testUserId);
    expect(activeCount).toBe(1);

    // Should have 2 archived domains
    const archivedCount = await countArchivedTrackedDomainsForUser(testUserId);
    expect(archivedCount).toBe(2);
  });

  it("archives all domains if count exceeds available", async () => {
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "token1",
    });

    const archived = await archiveOldestActiveDomains(testUserId, 10);
    expect(archived).toBe(1);

    const activeCount = await countActiveTrackedDomainsForUser(testUserId);
    expect(activeCount).toBe(0);
  });
});

describe("getArchivedDomainsForUser", () => {
  it("returns empty array when user has no archived domains", async () => {
    await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });

    const result = await getArchivedDomainsForUser(testUserId);
    expect(result).toEqual([]);
  });

  it("returns only archived domains with expected fields", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    const createdId = created!.id;

    // Archive the domain
    await archiveTrackedDomain(createdId);

    const result = await getArchivedDomainsForUser(testUserId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: createdId,
      userId: testUserId,
      domainName: "example.test",
      verified: false,
      verificationToken: "test-token",
    });
    expect(result[0].archivedAt).toBeInstanceOf(Date);
  });
});

describe("getTrackedDomainsForUser with includeArchived", () => {
  it("excludes archived domains by default", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    await archiveTrackedDomain(created!.id);

    const result = await getTrackedDomainsForUser(testUserId);
    expect(result).toEqual([]);
  });

  it("includes archived domains when includeArchived is true", async () => {
    const created = await createTrackedDomain({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    });
    expect(created).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: safe after expect(created).not.toBeNull()
    await archiveTrackedDomain(created!.id);

    const result = await getTrackedDomainsForUser(testUserId, true);
    expect(result).toHaveLength(1);
    expect(result[0].archivedAt).toBeInstanceOf(Date);
  });
});
