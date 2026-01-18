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

// Mock workflow/api to avoid starting real workflows
vi.mock("workflow/api", () => ({
  start: vi.fn(),
}));

// Mock next/headers to avoid errors outside request context
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

// Mock next/server after() to be a no-op
vi.mock("next/server", () => ({
  after: vi.fn((fn) => fn()),
}));

// Mock inngest client to avoid sending real events
vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ["test-event-id"] }),
  },
}));

// Mock resend to avoid sending real emails
vi.mock("@/lib/resend", () => ({
  sendEmail: vi.fn().mockResolvedValue({ error: null }),
}));

import { start } from "workflow/api";
import { db } from "@/lib/db/client";
import {
  domains,
  userSubscriptions,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { sendEmail } from "@/lib/resend";
import { createCaller } from "@/server/routers/_app";
import type { Context } from "@/trpc/init";

// Test fixtures - use valid RFC 4122 UUIDs (version 1, variant 1)
const TEST_USER_ID = "test-user-id-12345";
const TEST_USER_2_ID = "test-user-id-67890";
const TEST_DOMAIN = "example.com";
// Valid UUIDs require version digit [1-8] at position 15 and variant [89ab] at position 20
const TEST_DOMAIN_ID = "a0000000-0000-1000-a000-000000000001";
const TEST_DOMAIN_2_ID = "a0000000-0000-1000-a000-000000000002";
const TEST_TRACKED_ID = "b0000000-0000-1000-a000-000000000010";
const TEST_TRACKED_2_ID = "b0000000-0000-1000-a000-000000000011";

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
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

beforeEach(async () => {
  vi.clearAllMocks();

  // Clean up tracked domains between tests
  await db.delete(userTrackedDomains);
});

describe("tracking router", () => {
  describe("authentication", () => {
    it("rejects unauthenticated requests to listDomains", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.tracking.listDomains()).rejects.toThrow(
        "must be logged in",
      );
    });

    it("rejects unauthenticated requests to addDomain", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.tracking.addDomain({ domain: TEST_DOMAIN }),
      ).rejects.toThrow("must be logged in");
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
      expect(result.verificationToken).toBeDefined();
      expect(result.resumed).toBe(false);
    });

    it("triggers auto-verification event", async () => {
      const caller = createAuthenticatedCaller();

      await caller.tracking.addDomain({ domain: TEST_DOMAIN });

      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "domain/verification.new",
          data: expect.objectContaining({
            domainName: TEST_DOMAIN,
          }),
        }),
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

      await expect(
        caller.tracking.addDomain({ domain: TEST_DOMAIN }),
      ).rejects.toThrow("already tracking");
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

      await expect(
        caller.tracking.addDomain({ domain: "not-a-domain" }),
      ).rejects.toThrow("Invalid domain");
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
      const domains = await caller.tracking.listDomains();
      expect(domains).toEqual([]);
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
  });

  describe("verifyDomain", () => {
    it("runs verification workflow", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unverified domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      vi.mocked(start).mockResolvedValue({
        returnValue: Promise.resolve({
          success: true,
          data: { verified: true, method: "dns_txt" },
        }),
      } as never);

      const result = await caller.tracking.verifyDomain({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.verified).toBe(true);
      expect(result.method).toBe("dns_txt");
      expect(start).toHaveBeenCalled();
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
      expect(start).not.toHaveBeenCalled(); // Should not re-run workflow
    });

    it("returns not verified when workflow fails", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unverified domain
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "test-token",
        verified: false,
      });

      vi.mocked(start).mockResolvedValue({
        returnValue: Promise.resolve({
          success: false,
          data: { verified: false },
        }),
      } as never);

      const result = await caller.tracking.verifyDomain({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.verified).toBe(false);
      expect(result.method).toBeNull();
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
          subject: expect.stringContaining(TEST_DOMAIN),
        }),
      );
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
