/* @vitest-environment node */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

// Mock workflow/api to avoid starting real workflows
vi.mock("workflow/api", () => ({
  start: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
    runId: "mock-run-id",
    returnValue: Promise.resolve({ success: true, data: {} }),
  }),
}));

// Mock the verification module verifyDomain calls now hit directly
const verificationMock = vi.hoisted(() => ({
  verifyDomain: vi.fn<typeof import("@domainstack/core/verification").verifyDomain>(),
  verifyDomainByMethod:
    vi.fn<typeof import("@domainstack/core/verification").verifyDomainByMethod>(),
}));
vi.mock("@domainstack/core/verification", () => verificationMock);

// Mock email package to avoid sending real emails
vi.mock("@domainstack/email", () => ({
  sendEmail: vi.fn<(...args: unknown[]) => Promise<{ error: null }>>().mockResolvedValue({
    error: null,
  }),
}));

// Mock email templates to avoid rendering React Email components in tests
vi.mock("@domainstack/email/templates/verification-instructions", () => ({
  default: vi.fn<(...args: unknown[]) => null>().mockReturnValue(null),
}));

// Now import modules that depend on the db
const { domains, domainSnapshots, registrations, userSubscriptions, users, userTrackedDomains } =
  await import("@domainstack/db/schema");
const { eq } = await import("@domainstack/db/drizzle");
const {
  bulkArchiveTrackedDomains,
  bulkRemoveTrackedDomains,
  countTrackedDomainsByStatus,
  markVerificationFailing,
  markVerificationSuccessful,
  revokeVerification,
  verifyTrackedDomain,
} = await import("@domainstack/db/queries/tracked-domains");
const { sendEmail } = await import("@domainstack/email");
const { default: VerificationInstructionsEmail } =
  await import("@domainstack/email/templates/verification-instructions");
const { getRateLimiter } = await import("@domainstack/redis/ratelimit");
const { start } = await import("workflow/api");
const { createCaller } = await import("../router");

import type { Context } from "../context";

// Test fixtures - use valid RFC 4122 UUIDs (version 1, variant 1)
const TEST_USER_ID = "test-user-id-12345";
const TEST_USER_2_ID = "test-user-id-67890";
const TEST_DOMAIN = "example.com";
// Valid UUIDs require version digit [1-8] at position 15 and variant [89ab] at position 20
const TEST_DOMAIN_ID = "a0000000-0000-1000-a000-000000000001";
const TEST_DOMAIN_2_ID = "a0000000-0000-1000-a000-000000000002";
const TEST_TRACKED_ID = "b0000000-0000-1000-a000-000000000010";
const TEST_TRACKED_2_ID = "b0000000-0000-1000-a000-000000000011";

// Extra domains for exercising the free-plan quota (5 active domains)
const QUOTA_DOMAIN_IDS = [
  "a0000000-0000-1000-a000-000000000003",
  "a0000000-0000-1000-a000-000000000004",
  "a0000000-0000-1000-a000-000000000005",
  "a0000000-0000-1000-a000-000000000006",
  "a0000000-0000-1000-a000-000000000007",
];
const QUOTA_DOMAIN_NAMES = QUOTA_DOMAIN_IDS.map((_, i) => `quota-domain-${i + 3}.com`);

// Helper to create a caller with authenticated context
function createAuthenticatedCaller(userId = TEST_USER_ID) {
  const context: Context = {
    req: undefined,
    ip: "127.0.0.1",
    session: {
      user: {
        id: userId,
        name: "Test User",
        email: "test@example.com",
      },
    },
  };
  return createCaller(context);
}

// Helper to create a caller without authentication
function createUnauthenticatedCaller() {
  const context: Context = {
    req: undefined,
    ip: "127.0.0.1",
    session: null,
  };
  return createCaller(context);
}

beforeAll(async () => {
  // Create test users
  await db
    .insert(users)
    .values([
      {
        id: TEST_USER_ID,
        name: "Test User",
        email: "test@example.com",
        emailVerified: true,
      },
      {
        id: TEST_USER_2_ID,
        name: "Test User 2",
        email: "test2@example.com",
        emailVerified: true,
      },
    ])
    .onConflictDoNothing();

  // Create subscriptions for test users (required for addDomain quota check)
  await db
    .insert(userSubscriptions)
    .values([
      { userId: TEST_USER_ID, tier: "free" },
      { userId: TEST_USER_2_ID, tier: "free" },
    ])
    .onConflictDoNothing();

  // Create test domains
  await db
    .insert(domains)
    .values([
      {
        id: TEST_DOMAIN_ID,
        name: TEST_DOMAIN,
        tld: "com",
        unicodeName: TEST_DOMAIN,
      },
      {
        id: TEST_DOMAIN_2_ID,
        name: "example2.com",
        tld: "com",
        unicodeName: "example2.com",
      },
      ...QUOTA_DOMAIN_IDS.map((id, i) => ({
        id,
        name: QUOTA_DOMAIN_NAMES[i],
        tld: "com",
        unicodeName: QUOTA_DOMAIN_NAMES[i],
      })),
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await closePGliteDb();
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Clean up tracked domains between tests
  await db.delete(userTrackedDomains);
  await db.delete(registrations);
});

describe("tracking router", () => {
  describe("authentication", () => {
    it("rejects unauthenticated requests to listDomains", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.tracking.listDomains()).rejects.toThrow("must be logged in");
    });

    it("rejects unauthenticated requests to addDomain", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.tracking.addDomain({ domain: TEST_DOMAIN })).rejects.toThrow(
        "must be logged in",
      );
    });
  });

  describe("listDomains", () => {
    it("returns empty array when user has no tracked domains", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.tracking.listDomains();

      expect(result).toEqual([]);
    });

    it("returns user's tracked domains", async () => {
      const caller = createAuthenticatedCaller();

      // Create a tracked domain directly in DB
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token-123",
        verified: true,
        verificationMethod: "dns_txt",
      });

      const result = await caller.tracking.listDomains();

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(TEST_TRACKED_ID);
    });

    it("excludes archived domains by default", async () => {
      const caller = createAuthenticatedCaller();

      // Create an archived tracked domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token-123",
        verified: true,
        archivedAt: new Date(),
      });

      const result = await caller.tracking.listDomains();

      expect(result).toEqual([]);
    });

    it("includes archived domains when requested", async () => {
      const caller = createAuthenticatedCaller();

      // Create an archived tracked domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token-123",
        verified: true,
        archivedAt: new Date(),
      });

      const result = await caller.tracking.listDomains({
        includeArchived: true,
      });

      expect(result.length).toBe(1);
    });

    it("only returns domains belonging to the authenticated user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create domain for different user
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_2_ID, // Different user
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token-123",
        verified: true,
      });

      const result = await caller.tracking.listDomains();

      expect(result).toEqual([]);
    });
  });

  describe("addDomain", () => {
    it("creates a new tracked domain", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.tracking.addDomain({ domain: TEST_DOMAIN });

      expect(result.id).toBeDefined();
      expect(result.domain).toBe(TEST_DOMAIN);
      expect(result.verificationToken).toMatch(/^[0-9a-f]{32}$/);
      expect(result.resumed).toBe(false);
    });

    it("tracks the registrable domain when given a subdomain", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.tracking.addDomain({ domain: `api.${TEST_DOMAIN}` });

      expect(result.domain).toBe(TEST_DOMAIN);
    });

    it("triggers auto-verification workflow", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.tracking.addDomain({ domain: TEST_DOMAIN });

      // Auto-verify workflow is started via startDeduplicated which calls start()
      expect(start).toHaveBeenCalledWith(
        expect.any(Function), // autoVerifyWorkflow
        [{ trackedDomainId: result.id }],
      );
    });

    it("returns existing unverified domain for resume", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unverified tracked domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "existing-token",
        verified: false,
      });

      const result = await caller.tracking.addDomain({ domain: TEST_DOMAIN });

      expect(result.id).toBe(TEST_TRACKED_ID);
      expect(result.verificationToken).toBe("existing-token");
      expect(result.resumed).toBe(true);
    });

    it("rejects adding already verified domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create a verified tracked domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "existing-token",
        verified: true,
        verificationMethod: "dns_txt",
      });

      await expect(caller.tracking.addDomain({ domain: TEST_DOMAIN })).rejects.toThrow(
        "already tracking",
      );
    });

    it("normalizes domain input", async () => {
      const caller = createAuthenticatedCaller();

      // www.example.com should be normalized to example.com
      const result = await caller.tracking.addDomain({
        domain: "www.example.com",
      });

      expect(result.domain).toBe("example.com");
    });

    it("rejects invalid domain", async () => {
      const caller = createAuthenticatedCaller();

      await expect(caller.tracking.addDomain({ domain: "not-a-domain" })).rejects.toThrow(
        "Enter a valid domain name, like example.com.",
      );
    });
  });

  describe("addDomain plan-limit enforcement", () => {
    // Free plan quota is 5 active domains (PLAN_QUOTAS.free).
    async function trackDomains(userId: string, domainIds: string[]) {
      await db.insert(userTrackedDomains).values(
        domainIds.map((domainId, i) => ({
          id: `b0000000-0000-1000-a000-0000000000${(20 + i).toString().padStart(2, "0")}`,
          userId,
          domainId,
          verificationToken: `token-${i}`,
          verified: true,
          verificationMethod: "dns_txt" as const,
        })),
      );
    }

    it("still succeeds under the limit", async () => {
      const caller = createAuthenticatedCaller();

      // 2 active domains, well under the free-plan quota of 5
      await trackDomains(TEST_USER_ID, [TEST_DOMAIN_ID, TEST_DOMAIN_2_ID]);

      const result = await caller.tracking.addDomain({ domain: QUOTA_DOMAIN_NAMES[0] });

      expect(result.id).toBeDefined();
      expect((await countTrackedDomainsByStatus(TEST_USER_ID)).active).toBe(3);
    });

    it("throws FORBIDDEN at exactly the limit", async () => {
      const caller = createAuthenticatedCaller();

      // 5 active domains == free-plan quota
      await trackDomains(TEST_USER_ID, [
        TEST_DOMAIN_ID,
        TEST_DOMAIN_2_ID,
        ...QUOTA_DOMAIN_IDS.slice(0, 3),
      ]);

      await expect(caller.tracking.addDomain({ domain: "over-the-limit.com" })).rejects.toThrow(
        "reached your domain tracking limit",
      );
      expect((await countTrackedDomainsByStatus(TEST_USER_ID)).active).toBe(5);
    });

    it("allows exactly one of two concurrent adds at max - 1", async () => {
      const caller = createAuthenticatedCaller();

      // 4 active domains == quota - 1
      await trackDomains(TEST_USER_ID, [
        TEST_DOMAIN_ID,
        TEST_DOMAIN_2_ID,
        ...QUOTA_DOMAIN_IDS.slice(0, 2),
      ]);

      // Two different domains added concurrently (double-click / two tabs).
      // Note: PGlite is a single connection and may serialize these transactions
      // regardless of the advisory lock, so this test documents the contract and
      // guards against regressions with a real connection pool rather than proving
      // true concurrency here.
      const results = await Promise.allSettled([
        caller.tracking.addDomain({ domain: QUOTA_DOMAIN_NAMES[3] }),
        caller.tracking.addDomain({ domain: QUOTA_DOMAIN_NAMES[4] }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({
        message: expect.stringContaining("reached your domain tracking limit"),
      });
      expect((await countTrackedDomainsByStatus(TEST_USER_ID)).active).toBe(5);
    });
  });

  describe("removeDomain", () => {
    it("removes a tracked domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create a tracked domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
      });

      const result = await caller.tracking.removeDomain({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.success).toBe(true);

      // Verify it was deleted
      const listedDomains = await caller.tracking.listDomains();
      expect(listedDomains).toEqual([]);
    });

    it("returns NOT_FOUND for non-existent domain", async () => {
      const caller = createAuthenticatedCaller();

      // Use a valid RFC 4122 UUID that doesn't exist in DB
      await expect(
        caller.tracking.removeDomain({
          trackedDomainId: "c0000000-0000-1000-a000-000000000099",
        }),
      ).rejects.toThrow("not found");
    });

    it("returns NOT_FOUND for domain owned by another user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create domain for different user
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_2_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
      });

      await expect(
        caller.tracking.removeDomain({ trackedDomainId: TEST_TRACKED_ID }),
      ).rejects.toThrow("not found");
    });
  });

  describe("archiveDomain", () => {
    it("archives a tracked domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create a tracked domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
      });

      const result = await caller.tracking.archiveDomain({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.success).toBe(true);
      expect(result.archivedAt).toBeDefined();
    });

    it("rejects archiving already archived domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create an already archived domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
        archivedAt: new Date(),
      });

      await expect(
        caller.tracking.archiveDomain({ trackedDomainId: TEST_TRACKED_ID }),
      ).rejects.toThrow("already archived");
    });

    it("returns not found for another user's domain and leaves it unarchived", async () => {
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
      });

      await expect(
        createAuthenticatedCaller(TEST_USER_2_ID).tracking.archiveDomain({
          trackedDomainId: TEST_TRACKED_ID,
        }),
      ).rejects.toThrow("not found");

      const [row] = await db
        .select({ archivedAt: userTrackedDomains.archivedAt })
        .from(userTrackedDomains)
        .where(eq(userTrackedDomains.id, TEST_TRACKED_ID));
      expect(row?.archivedAt).toBeNull();
    });
  });

  describe("muteDomain", () => {
    beforeEach(async () => {
      // Create tracked domain for these tests
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "token",
        verified: true,
      });
    });

    it("mutes a domain", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.tracking.muteDomain({
        trackedDomainId: TEST_TRACKED_ID,
        muted: true,
      });

      expect(result.muted).toBe(true);
    });

    it("unmutes a domain", async () => {
      const caller = createAuthenticatedCaller();

      // First mute it
      await caller.tracking.muteDomain({
        trackedDomainId: TEST_TRACKED_ID,
        muted: true,
      });

      // Then unmute
      const result = await caller.tracking.muteDomain({
        trackedDomainId: TEST_TRACKED_ID,
        muted: false,
      });

      expect(result.muted).toBe(false);
    });

    it("returns not found for non-existent domain", async () => {
      const caller = createAuthenticatedCaller();

      await expect(
        caller.tracking.muteDomain({
          trackedDomainId: "c0000000-0000-1000-a000-000000000999",
          muted: true,
        }),
      ).rejects.toThrow("not found");
    });

    it("returns not found for domain owned by another user (prevents enumeration)", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_2_ID);

      // Security: Returns same error for "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      await expect(
        caller.tracking.muteDomain({
          trackedDomainId: TEST_TRACKED_ID,
          muted: true,
        }),
      ).rejects.toThrow("not found");
    });
  });

  describe("unarchiveDomain", () => {
    it("unarchives a tracked domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create an archived domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
        archivedAt: new Date(),
      });

      const result = await caller.tracking.unarchiveDomain({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.success).toBe(true);
    });

    it("rejects unarchiving non-archived domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create an active (non-archived) domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
      });

      await expect(
        caller.tracking.unarchiveDomain({ trackedDomainId: TEST_TRACKED_ID }),
      ).rejects.toThrow("not archived");
    });

    it("discards the stale monitoring snapshot", async () => {
      const caller = createAuthenticatedCaller();

      // Create an archived domain with a stale snapshot
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
        archivedAt: new Date(),
      });
      await db.insert(domainSnapshots).values({ trackedDomainId: TEST_TRACKED_ID });

      await caller.tracking.unarchiveDomain({ trackedDomainId: TEST_TRACKED_ID });

      const remaining = await db
        .select()
        .from(domainSnapshots)
        .where(eq(domainSnapshots.trackedDomainId, TEST_TRACKED_ID));

      expect(remaining).toHaveLength(0);
    });

    it("keeps the snapshot when unarchive is rejected", async () => {
      const caller = createAuthenticatedCaller();

      // Create an active (non-archived) domain with a snapshot
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
      });
      await db.insert(domainSnapshots).values({ trackedDomainId: TEST_TRACKED_ID });

      await expect(
        caller.tracking.unarchiveDomain({ trackedDomainId: TEST_TRACKED_ID }),
      ).rejects.toThrow("not archived");

      const remaining = await db
        .select()
        .from(domainSnapshots)
        .where(eq(domainSnapshots.trackedDomainId, TEST_TRACKED_ID));

      expect(remaining).toHaveLength(1);
    });
  });

  describe("verifyDomain", () => {
    it("verifies ownership directly", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unverified domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      verificationMock.verifyDomain.mockResolvedValue({ verified: true, method: "dns_txt" });

      const result = await caller.tracking.verifyDomain({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result).toEqual({ verified: true, method: "dns_txt" });
      expect(verificationMock.verifyDomain).toHaveBeenCalledWith(
        "example.com",
        "test-token",
        expect.objectContaining({}),
      );
      // Only the snapshot-initialization workflow should have been started.
      expect(vi.mocked(start).mock.calls.length).toBe(1);
    });

    it("returns verified status for already verified domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create a verified domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
        verificationMethod: "meta_tag",
      });

      const result = await caller.tracking.verifyDomain({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.verified).toBe(true);
      expect(result.method).toBe("meta_tag");
      expect(verificationMock.verifyDomain).not.toHaveBeenCalled();
      expect(verificationMock.verifyDomainByMethod).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    });

    it("verifyTrackedDomain does not wipe a snapshot created after it already verified (concurrent verify race)", async () => {
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      // First call: genuinely verifies (no snapshot exists yet, nothing to wipe).
      const first = await verifyTrackedDomain(TEST_TRACKED_ID, "dns_txt");
      expect(first?.verified).toBe(true);

      // A concurrent process (e.g. initializeSnapshotWorkflow) establishes the
      // baseline snapshot right after.
      await db.insert(domainSnapshots).values({ trackedDomainId: TEST_TRACKED_ID });

      // Second call: a racing verifier (e.g. the auto-verify workflow's own
      // independent check) reaches verifyTrackedDomain moments later. It must
      // no-op instead of wiping the snapshot just established above.
      const second = await verifyTrackedDomain(TEST_TRACKED_ID, "meta_tag");
      expect(second?.verified).toBe(true);
      // The losing call must not overwrite the winning method.
      expect(second?.verificationMethod).toBe("dns_txt");

      const snapshot = await db
        .select()
        .from(domainSnapshots)
        .where(eq(domainSnapshots.trackedDomainId, TEST_TRACKED_ID));
      expect(snapshot.length).toBe(1);
    });

    it("returns not verified when no method succeeds", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unverified domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      verificationMock.verifyDomain.mockResolvedValue({ verified: false, method: null });

      const result = await caller.tracking.verifyDomain({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.verified).toBe(false);
      expect(result.method).toBeNull();
      expect(start).not.toHaveBeenCalled();
    });

    it("uses only the requested method", async () => {
      const caller = createAuthenticatedCaller();

      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      verificationMock.verifyDomainByMethod.mockResolvedValue({
        verified: true,
        method: "meta_tag",
      });

      const result = await caller.tracking.verifyDomain({
        trackedDomainId: TEST_TRACKED_ID,
        method: "meta_tag",
      });

      expect(result).toEqual({ verified: true, method: "meta_tag" });
      expect(verificationMock.verifyDomainByMethod).toHaveBeenCalledWith(
        "example.com",
        "test-token",
        "meta_tag",
        expect.anything(),
      );
      expect(verificationMock.verifyDomain).not.toHaveBeenCalled();
    });

    it("propagates a verifier crash as an error", async () => {
      const caller = createAuthenticatedCaller();

      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      verificationMock.verifyDomain.mockRejectedValue(new Error("boom"));

      await expect(
        caller.tracking.verifyDomain({ trackedDomainId: TEST_TRACKED_ID }),
      ).rejects.toThrow("boom");

      const [tracked] = await db
        .select()
        .from(userTrackedDomains)
        .where(eq(userTrackedDomains.id, TEST_TRACKED_ID));

      expect(tracked?.verified).toBe(false);
    });

    it("discards a snapshot from a previous verified period", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unverified domain with a leftover snapshot
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });
      await db.insert(domainSnapshots).values({ trackedDomainId: TEST_TRACKED_ID });

      verificationMock.verifyDomain.mockResolvedValue({ verified: true, method: "dns_txt" });

      await caller.tracking.verifyDomain({ trackedDomainId: TEST_TRACKED_ID });

      const remaining = await db
        .select()
        .from(domainSnapshots)
        .where(eq(domainSnapshots.trackedDomainId, TEST_TRACKED_ID));

      expect(remaining).toHaveLength(0);
    });
  });

  describe("registrant contacts", () => {
    const contact = {
      type: "registrant" as const,
      name: "REDACTED FOR PRIVACY",
      email: "Please query the RDDS service of the Registrar of Record",
      country: "US",
    };

    async function trackDomainWithRegistration() {
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token-123",
        verified: true,
        verificationMethod: "dns_txt",
      });
      await db
        .insert(registrations)
        .values({
          domainId: TEST_DOMAIN_ID,
          isRegistered: true,
          source: "rdap",
          contacts: [contact],
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        })
        .onConflictDoNothing();
    }

    it("listDomains does not return contacts at all", async () => {
      await trackDomainWithRegistration();

      const [item] = await createAuthenticatedCaller().tracking.listDomains();

      expect(item?.registrar).not.toHaveProperty("registrantInfo");
    });
  });

  describe("getDomainDetails", () => {
    it("returns domain details for owned domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create a tracked domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
      });

      const result = await caller.tracking.getDomainDetails({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_TRACKED_ID);
    });

    it("returns NOT_FOUND for domain owned by another user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create domain for different user
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_2_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
      });

      await expect(
        caller.tracking.getDomainDetails({ trackedDomainId: TEST_TRACKED_ID }),
      ).rejects.toThrow("not found");
    });
  });

  describe("getTrackingStatus", () => {
    it("returns the status of an unverified tracked domain", async () => {
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
        verificationMethod: "dns_txt",
      });

      const result = await createAuthenticatedCaller().tracking.getTrackingStatus({
        domain: TEST_DOMAIN,
      });

      expect(result).toEqual({
        id: TEST_TRACKED_ID,
        verified: false,
        verificationMethod: "dns_txt",
      });
    });

    it("returns the status of a verified tracked domain", async () => {
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: true,
        verificationMethod: "dns_txt",
      });

      const result = await createAuthenticatedCaller().tracking.getTrackingStatus({
        domain: TEST_DOMAIN,
      });

      expect(result?.verified).toBe(true);
    });

    it("returns null when the domain is not tracked", async () => {
      const result = await createAuthenticatedCaller().tracking.getTrackingStatus({
        domain: TEST_DOMAIN,
      });

      expect(result).toBeNull();
    });

    it("does not expose another user's tracked domain", async () => {
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_2_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
      });

      const result = await createAuthenticatedCaller().tracking.getTrackingStatus({
        domain: TEST_DOMAIN,
      });

      expect(result).toBeNull();
    });

    it("returns null for an archived tracked domain", async () => {
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        archivedAt: new Date(),
      });

      const result = await createAuthenticatedCaller().tracking.getTrackingStatus({
        domain: TEST_DOMAIN,
      });

      expect(result).toBeNull();
    });

    it("does not create a domain record for an unknown domain", async () => {
      const before = await db.select().from(domains);

      const result = await createAuthenticatedCaller().tracking.getTrackingStatus({
        domain: "never-seen-before.com",
      });

      const after = await db.select().from(domains);
      expect(result).toBeNull();
      expect(after).toHaveLength(before.length);
    });

    it("rejects unauthenticated requests", async () => {
      await expect(
        createUnauthenticatedCaller().tracking.getTrackingStatus({ domain: TEST_DOMAIN }),
      ).rejects.toThrow("must be logged in");
    });
  });

  describe("getVerificationData", () => {
    it("returns verification data for owned domain", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unverified domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token-abc",
        verified: false,
      });

      const result = await caller.tracking.getVerificationData({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.domain).toBe(TEST_DOMAIN);
      expect(result.verificationToken).toBe("test-token-abc");
    });
  });

  describe("bulkArchiveDomains", () => {
    it("archives multiple domains", async () => {
      const caller = createAuthenticatedCaller();

      // Create two tracked domains
      await db.insert(userTrackedDomains).values([
        {
          id: TEST_TRACKED_ID,
          userId: TEST_USER_ID,
          domainId: TEST_DOMAIN_ID,
          verificationToken: "token1",
          verified: true,
        },
        {
          id: TEST_TRACKED_2_ID,
          userId: TEST_USER_ID,
          domainId: TEST_DOMAIN_2_ID,
          verificationToken: "token2",
          verified: true,
        },
      ]);

      const result = await caller.tracking.bulkArchiveDomains({
        trackedDomainIds: [TEST_TRACKED_ID, TEST_TRACKED_2_ID],
      });

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    it("handles mixed owned and not-owned domains", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create domain owned by user 1
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "token1",
        verified: true,
      });

      // Create domain owned by user 2
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_2_ID,
        userId: TEST_USER_2_ID,
        domainId: TEST_DOMAIN_2_ID,
        verificationToken: "token2",
        verified: true,
      });

      const result = await caller.tracking.bulkArchiveDomains({
        trackedDomainIds: [TEST_TRACKED_ID, TEST_TRACKED_2_ID],
      });

      // Only user's own domain should be archived
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });
  });

  describe("reverification writes", () => {
    const failedAt = new Date("2026-09-01T00:00:00.000Z");

    async function seedTracked(values: Partial<typeof userTrackedDomains.$inferInsert>) {
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "token1",
        verificationMethod: "dns_txt",
        ...values,
      });
    }

    async function readTracked() {
      const [row] = await db
        .select()
        .from(userTrackedDomains)
        .where(eq(userTrackedDomains.id, TEST_TRACKED_ID));
      return row;
    }

    it("revokes the episode it was given", async () => {
      await seedTracked({
        verified: true,
        verificationStatus: "failing",
        verificationFailedAt: failedAt,
      });

      expect(await revokeVerification(TEST_TRACKED_ID, failedAt)).not.toBeNull();
      expect(await readTracked()).toMatchObject({
        verified: false,
        verificationStatus: "unverified",
        verificationFailedAt: null,
      });
    });

    it("does not revoke a domain that recovered or started a new episode", async () => {
      await seedTracked({ verified: true, verificationStatus: "verified" });
      expect(await revokeVerification(TEST_TRACKED_ID, failedAt)).toBeNull();
      expect(await readTracked()).toMatchObject({ verified: true, verificationStatus: "verified" });

      await db
        .update(userTrackedDomains)
        .set({ verificationStatus: "failing", verificationFailedAt: new Date("2026-09-10") })
        .where(eq(userTrackedDomains.id, TEST_TRACKED_ID));
      expect(await revokeVerification(TEST_TRACKED_ID, failedAt)).toBeNull();
      expect((await readTracked())?.verified).toBe(true);
    });

    it("does not mark a revoked domain as verified", async () => {
      await seedTracked({ verified: false, verificationStatus: "unverified" });

      expect(await markVerificationSuccessful(TEST_TRACKED_ID)).toBeNull();
      expect(await readTracked()).toMatchObject({
        verified: false,
        verificationStatus: "unverified",
      });
    });

    it("marks failing only from the expected state", async () => {
      await seedTracked({ verified: true, verificationStatus: "verified" });

      expect(
        await markVerificationFailing(TEST_TRACKED_ID, { status: "failing", failedAt: null }),
      ).toBeNull();
      const updated = await markVerificationFailing(TEST_TRACKED_ID, {
        status: "verified",
        failedAt: null,
      });
      expect(updated?.verificationStatus).toBe("failing");
      expect(updated?.verificationFailedAt).toBeInstanceOf(Date);
    });
  });

  describe("bulk query classification", () => {
    const MISSING_ID = "b0000000-0000-1000-a000-0000000000ff";
    const OTHER_USERS_ID = "b0000000-0000-1000-a000-000000000012";
    const archivedAt = new Date("2026-01-01T00:00:00.000Z");

    async function seedMixedRows() {
      await db.insert(userTrackedDomains).values([
        {
          id: TEST_TRACKED_ID,
          userId: TEST_USER_ID,
          domainId: TEST_DOMAIN_ID,
          verificationToken: "token1",
          verified: true,
        },
        {
          id: TEST_TRACKED_2_ID,
          userId: TEST_USER_ID,
          domainId: TEST_DOMAIN_2_ID,
          verificationToken: "token2",
          verified: true,
          archivedAt,
        },
        {
          id: OTHER_USERS_ID,
          userId: TEST_USER_2_ID,
          domainId: TEST_DOMAIN_ID,
          verificationToken: "token3",
          verified: true,
        },
      ]);
    }

    async function archivedAtOf(id: string) {
      const [row] = await db
        .select({ archivedAt: userTrackedDomains.archivedAt })
        .from(userTrackedDomains)
        .where(eq(userTrackedDomains.id, id));
      return row?.archivedAt;
    }

    it("archives only owned, unarchived rows and sorts the rest", async () => {
      await seedMixedRows();

      const result = await bulkArchiveTrackedDomains(TEST_USER_ID, [
        TEST_TRACKED_ID,
        TEST_TRACKED_2_ID,
        OTHER_USERS_ID,
        MISSING_ID,
      ]);

      expect(result).toEqual({
        succeeded: [TEST_TRACKED_ID],
        alreadyProcessed: [TEST_TRACKED_2_ID],
        notOwned: [OTHER_USERS_ID],
        notFound: [MISSING_ID],
      });
      // The already-archived row keeps its original timestamp; the other user's is untouched.
      expect(await archivedAtOf(TEST_TRACKED_2_ID)).toEqual(archivedAt);
      expect(await archivedAtOf(OTHER_USERS_ID)).toBeNull();
    });

    it("removes only owned rows", async () => {
      await seedMixedRows();

      const result = await bulkRemoveTrackedDomains(TEST_USER_ID, [
        TEST_TRACKED_ID,
        OTHER_USERS_ID,
        MISSING_ID,
      ]);

      expect(result).toEqual({
        succeeded: [TEST_TRACKED_ID],
        notOwned: [OTHER_USERS_ID],
        notFound: [MISSING_ID],
      });
      expect(await archivedAtOf(OTHER_USERS_ID)).toBeNull();
    });

    it("returns an empty result for no ids", async () => {
      expect(await bulkArchiveTrackedDomains(TEST_USER_ID, [])).toEqual({
        succeeded: [],
        alreadyProcessed: [],
        notFound: [],
        notOwned: [],
      });
    });
  });

  describe("bulkRemoveDomains", () => {
    it("removes multiple domains", async () => {
      const caller = createAuthenticatedCaller();

      // Create two tracked domains
      await db.insert(userTrackedDomains).values([
        {
          id: TEST_TRACKED_ID,
          userId: TEST_USER_ID,
          domainId: TEST_DOMAIN_ID,
          verificationToken: "token1",
          verified: true,
        },
        {
          id: TEST_TRACKED_2_ID,
          userId: TEST_USER_ID,
          domainId: TEST_DOMAIN_2_ID,
          verificationToken: "token2",
          verified: true,
        },
      ]);

      const result = await caller.tracking.bulkRemoveDomains({
        trackedDomainIds: [TEST_TRACKED_ID, TEST_TRACKED_2_ID],
      });

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);

      // Verify they were deleted
      const remaining = await caller.tracking.listDomains();
      expect(remaining).toEqual([]);
    });
  });

  describe("bulkMuteDomains", () => {
    it("mutes multiple domains", async () => {
      const caller = createAuthenticatedCaller();

      await db.insert(userTrackedDomains).values([
        {
          id: TEST_TRACKED_ID,
          userId: TEST_USER_ID,
          domainId: TEST_DOMAIN_ID,
          verificationToken: "token1",
          verified: true,
        },
        {
          id: TEST_TRACKED_2_ID,
          userId: TEST_USER_ID,
          domainId: TEST_DOMAIN_2_ID,
          verificationToken: "token2",
          verified: true,
        },
      ]);

      const result = await caller.tracking.bulkMuteDomains({
        trackedDomainIds: [TEST_TRACKED_ID, TEST_TRACKED_2_ID],
        muted: true,
      });

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);

      const listed = await caller.tracking.listDomains();
      expect(listed.every((d) => d.muted)).toBe(true);
    });

    it("treats already-muted domains as no-ops", async () => {
      const caller = createAuthenticatedCaller();

      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "token1",
        verified: true,
        muted: true,
      });

      const result = await caller.tracking.bulkMuteDomains({
        trackedDomainIds: [TEST_TRACKED_ID],
        muted: true,
      });

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it("handles mixed owned and not-owned domains", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "token1",
        verified: true,
      });

      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_2_ID,
        userId: TEST_USER_2_ID,
        domainId: TEST_DOMAIN_2_ID,
        verificationToken: "token2",
        verified: true,
      });

      const result = await caller.tracking.bulkMuteDomains({
        trackedDomainIds: [TEST_TRACKED_ID, TEST_TRACKED_2_ID],
        muted: true,
      });

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });
  });

  describe("sendVerificationInstructions", () => {
    it("sends verification email", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unverified domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      const result = await caller.tracking.sendVerificationInstructions({
        trackedDomainId: TEST_TRACKED_ID,
        recipientEmail: "admin@example.com",
      });

      expect(result.success).toBe(true);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@example.com",
          replyTo: "test@example.com",
          subject: expect.stringContaining(TEST_DOMAIN),
        }),
        expect.objectContaining({
          baseUrl: expect.any(String),
        }),
      );
      expect(vi.mocked(VerificationInstructionsEmail).mock.calls[0][0]).not.toHaveProperty(
        "senderName",
      );
    });

    it("rejects when the recipient has hit the cross-account limit", async () => {
      const caller = createAuthenticatedCaller();
      const limiterMock = vi.mocked(getRateLimiter);
      const originalImplementation = limiterMock.getMockImplementation();

      limiterMock.mockImplementation(
        (config) =>
          ({
            limit: vi.fn<(identifier: string) => Promise<unknown>>().mockResolvedValue({
              success: config.requests !== 3,
              limit: config.requests,
              remaining: 0,
              reset: Date.now() + 60_000,
              pending: Promise.resolve(),
            }),
          }) as never,
      );

      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      try {
        await expect(
          caller.tracking.sendVerificationInstructions({
            trackedDomainId: TEST_TRACKED_ID,
            recipientEmail: "admin@example.com",
          }),
        ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
        expect(sendEmail).not.toHaveBeenCalled();
      } finally {
        limiterMock.mockImplementation(originalImplementation!);
      }
    });

    it("returns NOT_FOUND for domain owned by another user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create domain for different user
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_2_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      await expect(
        caller.tracking.sendVerificationInstructions({
          trackedDomainId: TEST_TRACKED_ID,
          recipientEmail: "admin@example.com",
        }),
      ).rejects.toThrow("not found");
    });
  });
});
