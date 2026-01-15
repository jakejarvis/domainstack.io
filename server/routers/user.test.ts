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

// Mock next/headers to avoid errors outside request context
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

// Mock next/server after() to be a no-op
vi.mock("next/server", () => ({
  after: vi.fn((fn) => fn()),
}));

import { db } from "@/lib/db/client";
import {
  accounts,
  calendarFeeds,
  domains,
  userNotificationPreferences,
  userSubscriptions,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import { createCaller } from "@/server/routers/_app";
import type { Context } from "@/trpc/init";

// Test fixtures
const TEST_USER_ID = "test-user-id-user-router";
const TEST_USER_2_ID = "test-user-id-user-router-2";
const TEST_DOMAIN_ID = "a0000000-0000-1000-a000-000000000100";
const TEST_DOMAIN_2_ID = "a0000000-0000-1000-a000-000000000101";
const TEST_TRACKED_ID = "b0000000-0000-1000-a000-000000000100";
const TEST_TRACKED_2_ID = "b0000000-0000-1000-a000-000000000101";

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
        email: "testuser@example.com",
        emailVerified: true,
      },
      {
        id: TEST_USER_2_ID,
        name: "Test User 2",
        email: "testuser2@example.com",
        emailVerified: true,
      },
    ])
    .onConflictDoNothing();

  // Create subscriptions for test users
  await db
    .insert(userSubscriptions)
    .values([
      { userId: TEST_USER_ID, tier: "free" },
      { userId: TEST_USER_2_ID, tier: "pro" },
    ])
    .onConflictDoNothing();

  // Create test domains
  await db
    .insert(domains)
    .values([
      {
        id: TEST_DOMAIN_ID,
        name: "usertest.com",
        tld: "com",
        unicodeName: "usertest.com",
      },
      {
        id: TEST_DOMAIN_2_ID,
        name: "usertest2.com",
        tld: "com",
        unicodeName: "usertest2.com",
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

  // Clean up data between tests
  await db.delete(calendarFeeds);
  await db.delete(userTrackedDomains);
  await db.delete(userNotificationPreferences);
  await db.delete(accounts);
});

describe("user router", () => {
  describe("authentication", () => {
    it("rejects unauthenticated requests to getSubscription", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.user.getSubscription()).rejects.toThrow(
        "must be logged in",
      );
    });

    it("rejects unauthenticated requests to getNotificationPreferences", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.user.getNotificationPreferences()).rejects.toThrow(
        "must be logged in",
      );
    });
  });

  describe("getLinkedAccounts", () => {
    it("returns empty array when user has no linked accounts", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.user.getLinkedAccounts();

      expect(result).toEqual([]);
    });

    it("returns linked OAuth accounts", async () => {
      const caller = createAuthenticatedCaller();

      // Create a linked account
      await db.insert(accounts).values({
        id: "account-1",
        accountId: "google-account-123",
        providerId: "google",
        userId: TEST_USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.user.getLinkedAccounts();

      expect(result.length).toBe(1);
      expect(result[0].providerId).toBe("google");
    });

    it("only returns accounts belonging to authenticated user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create account for different user
      await db.insert(accounts).values({
        id: "account-2",
        accountId: "github-account-456",
        providerId: "github",
        userId: TEST_USER_2_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.user.getLinkedAccounts();

      expect(result).toEqual([]);
    });
  });

  describe("getSubscription", () => {
    it("returns subscription data for free user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      const result = await caller.user.getSubscription();

      expect(result.plan).toBe("free");
      expect(result.planQuota).toBeGreaterThan(0);
      expect(result.activeCount).toBe(0);
      expect(result.archivedCount).toBe(0);
      expect(result.canAddMore).toBe(true);
    });

    it("returns subscription data for pro user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_2_ID);

      const result = await caller.user.getSubscription();

      expect(result.plan).toBe("pro");
      expect(result.planQuota).toBeGreaterThan(0);
    });

    it("includes tracked domain counts", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create active and archived domains (different domain IDs due to unique constraint)
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
          archivedAt: new Date(),
        },
      ]);

      const result = await caller.user.getSubscription();

      expect(result.activeCount).toBe(1);
      expect(result.archivedCount).toBe(1);
    });
  });

  describe("getNotificationPreferences", () => {
    it("returns default preferences for new user", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.user.getNotificationPreferences();

      expect(result).toBeDefined();
      expect(result.domainExpiry).toBeDefined();
      expect(result.certificateExpiry).toBeDefined();
    });

    it("returns existing preferences", async () => {
      const caller = createAuthenticatedCaller();

      // Create custom preferences
      await db.insert(userNotificationPreferences).values({
        userId: TEST_USER_ID,
        domainExpiry: { inApp: false, email: true },
      });

      const result = await caller.user.getNotificationPreferences();

      expect(result.domainExpiry).toEqual({ inApp: false, email: true });
    });
  });

  describe("updateGlobalNotificationPreferences", () => {
    it("updates notification preferences", async () => {
      const caller = createAuthenticatedCaller();

      // First get defaults to create the record
      await caller.user.getNotificationPreferences();

      const result = await caller.user.updateGlobalNotificationPreferences({
        domainExpiry: { inApp: true, email: false },
      });

      expect(result.domainExpiry).toEqual({ inApp: true, email: false });
    });

    it("supports partial updates", async () => {
      const caller = createAuthenticatedCaller();

      // First get defaults to create the record
      await caller.user.getNotificationPreferences();

      // Update only one preference
      const result = await caller.user.updateGlobalNotificationPreferences({
        certificateExpiry: { inApp: false, email: true },
      });

      expect(result.certificateExpiry).toEqual({ inApp: false, email: true });
      // Other preferences should remain unchanged
      expect(result.domainExpiry).toBeDefined();
    });
  });

  describe("updateDomainNotificationOverrides", () => {
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

    it("updates domain-specific notification overrides", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.user.updateDomainNotificationOverrides({
        trackedDomainId: TEST_TRACKED_ID,
        overrides: {
          domainExpiry: { inApp: false, email: false },
        },
      });

      expect(result.notificationOverrides.domainExpiry).toEqual({
        inApp: false,
        email: false,
      });
    });

    it("returns not found for non-existent domain", async () => {
      const caller = createAuthenticatedCaller();

      await expect(
        caller.user.updateDomainNotificationOverrides({
          trackedDomainId: "c0000000-0000-1000-a000-000000000999",
          overrides: { domainExpiry: { inApp: true, email: true } },
        }),
      ).rejects.toThrow("not found");
    });

    it("returns not found for domain owned by another user (prevents enumeration)", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_2_ID);

      // Security: Returns same error for "not found" and "wrong user"
      // to prevent enumeration attacks via error differentiation
      await expect(
        caller.user.updateDomainNotificationOverrides({
          trackedDomainId: TEST_TRACKED_ID,
          overrides: { domainExpiry: { inApp: true, email: true } },
        }),
      ).rejects.toThrow("not found");
    });
  });

  describe("resetDomainNotificationOverrides", () => {
    beforeEach(async () => {
      // Create tracked domain with overrides
      await db.insert(userTrackedDomains).values({
        id: TEST_TRACKED_ID,
        userId: TEST_USER_ID,
        domainId: TEST_DOMAIN_ID,
        verificationToken: "token",
        verified: true,
        notificationOverrides: {
          domainExpiry: { inApp: false, email: false },
        },
      });
    });

    it("resets domain notification overrides to empty", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.user.resetDomainNotificationOverrides({
        trackedDomainId: TEST_TRACKED_ID,
      });

      expect(result.notificationOverrides).toEqual({});
    });

    it("returns not found for non-existent domain", async () => {
      const caller = createAuthenticatedCaller();

      await expect(
        caller.user.resetDomainNotificationOverrides({
          trackedDomainId: "c0000000-0000-1000-a000-000000000999",
        }),
      ).rejects.toThrow("not found");
    });
  });

  // ============================================================================
  // Calendar Feed Tests
  // ============================================================================

  describe("getCalendarFeed", () => {
    it("returns disabled state when no feed exists", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.user.getCalendarFeed();

      expect(result.enabled).toBe(false);
    });

    it("returns feed URL when enabled", async () => {
      const caller = createAuthenticatedCaller();

      // Create a feed
      await db.insert(calendarFeeds).values({
        userId: TEST_USER_ID,
        token: "test-feed-token-123",
        enabled: true,
      });

      const result = await caller.user.getCalendarFeed();

      expect(result.enabled).toBe(true);
      expect(result.feedUrl).toContain("test-feed-token-123");
    });
  });

  describe("enableCalendarFeed", () => {
    it("creates a new calendar feed", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.user.enableCalendarFeed();

      expect(result.feedUrl).toBeDefined();
      expect(result.feedUrl).toContain("token=");
    });

    it("re-enables an existing disabled feed", async () => {
      const caller = createAuthenticatedCaller();

      // Create a disabled feed
      await db.insert(calendarFeeds).values({
        userId: TEST_USER_ID,
        token: "existing-token",
        enabled: false,
      });

      const result = await caller.user.enableCalendarFeed();

      expect(result.feedUrl).toContain("existing-token");
    });
  });

  describe("disableCalendarFeed", () => {
    it("disables an existing feed", async () => {
      const caller = createAuthenticatedCaller();

      // Create an enabled feed
      await db.insert(calendarFeeds).values({
        userId: TEST_USER_ID,
        token: "test-token",
        enabled: true,
      });

      const result = await caller.user.disableCalendarFeed();

      expect(result.success).toBe(true);
    });

    it("returns not found when no feed exists", async () => {
      const caller = createAuthenticatedCaller();

      await expect(caller.user.disableCalendarFeed()).rejects.toThrow(
        "not found",
      );
    });
  });

  describe("rotateCalendarFeedToken", () => {
    it("rotates the feed token", async () => {
      const caller = createAuthenticatedCaller();

      // Create a feed
      await db.insert(calendarFeeds).values({
        userId: TEST_USER_ID,
        token: "old-token",
        enabled: true,
      });

      const result = await caller.user.rotateCalendarFeedToken();

      expect(result.feedUrl).toBeDefined();
      expect(result.feedUrl).not.toContain("old-token");
    });

    it("returns not found when no feed exists", async () => {
      const caller = createAuthenticatedCaller();

      await expect(caller.user.rotateCalendarFeedToken()).rejects.toThrow(
        "not found",
      );
    });
  });

  describe("deleteCalendarFeed", () => {
    it("deletes the calendar feed", async () => {
      const caller = createAuthenticatedCaller();

      // Create a feed
      await db.insert(calendarFeeds).values({
        userId: TEST_USER_ID,
        token: "test-token",
        enabled: true,
      });

      const result = await caller.user.deleteCalendarFeed();

      expect(result.success).toBe(true);

      // Verify it's gone
      const feedStatus = await caller.user.getCalendarFeed();
      expect(feedStatus.enabled).toBe(false);
    });

    it("returns not found when no feed exists", async () => {
      const caller = createAuthenticatedCaller();

      await expect(caller.user.deleteCalendarFeed()).rejects.toThrow(
        "not found",
      );
    });
  });
});
