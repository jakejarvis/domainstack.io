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
import { notifications, users } from "@/lib/db/schema";
import { createCaller } from "@/server/routers/_app";
import type { Context } from "@/trpc/init";

// Test fixtures
const TEST_USER_ID = "test-user-id-notifications";
const TEST_USER_2_ID = "test-user-id-notifications-2";
const TEST_NOTIFICATION_ID = "c0000000-0000-1000-a000-000000000001";
const TEST_NOTIFICATION_2_ID = "c0000000-0000-1000-a000-000000000002";
const TEST_NOTIFICATION_3_ID = "c0000000-0000-1000-a000-000000000003";

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
        email: "testnotifications@example.com",
        emailVerified: true,
      },
      {
        id: TEST_USER_2_ID,
        name: "Test User 2",
        email: "testnotifications2@example.com",
        emailVerified: true,
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

  // Clean up notifications between tests
  await db.delete(notifications);
});

describe("notifications router", () => {
  describe("authentication", () => {
    it("rejects unauthenticated requests to list", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.notifications.list({ filter: "all" }),
      ).rejects.toThrow("must be logged in");
    });

    it("rejects unauthenticated requests to unreadCount", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(caller.notifications.unreadCount()).rejects.toThrow(
        "must be logged in",
      );
    });

    it("rejects unauthenticated requests to markRead", async () => {
      const caller = createUnauthenticatedCaller();

      await expect(
        caller.notifications.markRead({ id: TEST_NOTIFICATION_ID }),
      ).rejects.toThrow("must be logged in");
    });
  });

  describe("list", () => {
    it("returns empty list when user has no notifications", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.notifications.list({ filter: "all" });

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("returns user notifications", async () => {
      const caller = createAuthenticatedCaller();

      // Create a notification
      await db.insert(notifications).values({
        id: TEST_NOTIFICATION_ID,
        userId: TEST_USER_ID,
        type: "domain_expiry",
        title: "Domain Expiring",
        message: "Your domain is expiring soon",
        sentAt: new Date(),
      });

      const result = await caller.notifications.list({ filter: "all" });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(TEST_NOTIFICATION_ID);
      expect(result.items[0].title).toBe("Domain Expiring");
    });

    it("filters unread notifications", async () => {
      const caller = createAuthenticatedCaller();

      // Create read and unread notifications
      await db.insert(notifications).values([
        {
          id: TEST_NOTIFICATION_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Unread Notification",
          message: "This is unread",
          sentAt: new Date(),
          readAt: null,
        },
        {
          id: TEST_NOTIFICATION_2_ID,
          userId: TEST_USER_ID,
          type: "certificate_expiry",
          title: "Read Notification",
          message: "This is read",
          sentAt: new Date(),
          readAt: new Date(),
        },
      ]);

      const result = await caller.notifications.list({ filter: "unread" });

      expect(result.items.length).toBe(1);
      expect(result.items[0].title).toBe("Unread Notification");
    });

    it("filters read notifications", async () => {
      const caller = createAuthenticatedCaller();

      // Create read and unread notifications
      await db.insert(notifications).values([
        {
          id: TEST_NOTIFICATION_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Unread Notification",
          message: "This is unread",
          sentAt: new Date(),
          readAt: null,
        },
        {
          id: TEST_NOTIFICATION_2_ID,
          userId: TEST_USER_ID,
          type: "certificate_expiry",
          title: "Read Notification",
          message: "This is read",
          sentAt: new Date(),
          readAt: new Date(),
        },
      ]);

      const result = await caller.notifications.list({ filter: "read" });

      expect(result.items.length).toBe(1);
      expect(result.items[0].title).toBe("Read Notification");
    });

    it("only returns notifications belonging to authenticated user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create notification for different user
      await db.insert(notifications).values({
        id: TEST_NOTIFICATION_ID,
        userId: TEST_USER_2_ID,
        type: "domain_expiry",
        title: "Other User Notification",
        message: "This belongs to another user",
        sentAt: new Date(),
      });

      const result = await caller.notifications.list({ filter: "all" });

      expect(result.items).toEqual([]);
    });

    it("supports pagination with limit", async () => {
      const caller = createAuthenticatedCaller();

      // Create multiple notifications
      await db.insert(notifications).values([
        {
          id: TEST_NOTIFICATION_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Notification 1",
          message: "Message 1",
          sentAt: new Date(Date.now() - 3000),
        },
        {
          id: TEST_NOTIFICATION_2_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Notification 2",
          message: "Message 2",
          sentAt: new Date(Date.now() - 2000),
        },
        {
          id: TEST_NOTIFICATION_3_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Notification 3",
          message: "Message 3",
          sentAt: new Date(Date.now() - 1000),
        },
      ]);

      const result = await caller.notifications.list({
        limit: 2,
        filter: "all",
      });

      expect(result.items.length).toBe(2);
      expect(result.nextCursor).toBeDefined();
    });
  });

  describe("unreadCount", () => {
    it("returns 0 when no unread notifications", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.notifications.unreadCount();

      expect(result).toBe(0);
    });

    it("returns count of unread notifications", async () => {
      const caller = createAuthenticatedCaller();

      // Create unread notifications
      await db.insert(notifications).values([
        {
          id: TEST_NOTIFICATION_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Unread 1",
          message: "Message 1",
          sentAt: new Date(),
          readAt: null,
        },
        {
          id: TEST_NOTIFICATION_2_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Unread 2",
          message: "Message 2",
          sentAt: new Date(),
          readAt: null,
        },
        {
          id: TEST_NOTIFICATION_3_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Read",
          message: "Message 3",
          sentAt: new Date(),
          readAt: new Date(), // This one is read
        },
      ]);

      const result = await caller.notifications.unreadCount();

      expect(result).toBe(2);
    });

    it("only counts notifications for authenticated user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create notification for different user
      await db.insert(notifications).values({
        id: TEST_NOTIFICATION_ID,
        userId: TEST_USER_2_ID,
        type: "domain_expiry",
        title: "Other User Notification",
        message: "This belongs to another user",
        sentAt: new Date(),
        readAt: null,
      });

      const result = await caller.notifications.unreadCount();

      expect(result).toBe(0);
    });
  });

  describe("markRead", () => {
    it("marks a notification as read", async () => {
      const caller = createAuthenticatedCaller();

      // Create an unread notification
      await db.insert(notifications).values({
        id: TEST_NOTIFICATION_ID,
        userId: TEST_USER_ID,
        type: "domain_expiry",
        title: "Unread",
        message: "Message",
        sentAt: new Date(),
        readAt: null,
      });

      const result = await caller.notifications.markRead({
        id: TEST_NOTIFICATION_ID,
      });

      expect(result.success).toBe(true);

      // Verify it was marked as read
      const unreadCount = await caller.notifications.unreadCount();
      expect(unreadCount).toBe(0);
    });

    it("returns not found for non-existent notification", async () => {
      const caller = createAuthenticatedCaller();

      await expect(
        caller.notifications.markRead({
          id: "c0000000-0000-1000-a000-000000000999",
        }),
      ).rejects.toThrow("not found");
    });

    it("returns not found for notification owned by another user", async () => {
      const caller = createAuthenticatedCaller(TEST_USER_ID);

      // Create notification for different user
      await db.insert(notifications).values({
        id: TEST_NOTIFICATION_ID,
        userId: TEST_USER_2_ID,
        type: "domain_expiry",
        title: "Other User Notification",
        message: "This belongs to another user",
        sentAt: new Date(),
      });

      await expect(
        caller.notifications.markRead({ id: TEST_NOTIFICATION_ID }),
      ).rejects.toThrow("not found");
    });
  });

  describe("markAllRead", () => {
    it("marks all notifications as read", async () => {
      const caller = createAuthenticatedCaller();

      // Create multiple unread notifications
      await db.insert(notifications).values([
        {
          id: TEST_NOTIFICATION_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Unread 1",
          message: "Message 1",
          sentAt: new Date(),
          readAt: null,
        },
        {
          id: TEST_NOTIFICATION_2_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "Unread 2",
          message: "Message 2",
          sentAt: new Date(),
          readAt: null,
        },
      ]);

      const result = await caller.notifications.markAllRead();

      expect(result.count).toBe(2);

      // Verify all are read
      const unreadCount = await caller.notifications.unreadCount();
      expect(unreadCount).toBe(0);
    });

    it("returns 0 when no unread notifications", async () => {
      const caller = createAuthenticatedCaller();

      const result = await caller.notifications.markAllRead();

      expect(result.count).toBe(0);
    });

    it("only marks notifications for authenticated user", async () => {
      const callerUser1 = createAuthenticatedCaller(TEST_USER_ID);
      const callerUser2 = createAuthenticatedCaller(TEST_USER_2_ID);

      // Create notifications for both users
      await db.insert(notifications).values([
        {
          id: TEST_NOTIFICATION_ID,
          userId: TEST_USER_ID,
          type: "domain_expiry",
          title: "User 1 Notification",
          message: "Message 1",
          sentAt: new Date(),
          readAt: null,
        },
        {
          id: TEST_NOTIFICATION_2_ID,
          userId: TEST_USER_2_ID,
          type: "domain_expiry",
          title: "User 2 Notification",
          message: "Message 2",
          sentAt: new Date(),
          readAt: null,
        },
      ]);

      // User 1 marks all as read
      const result = await callerUser1.notifications.markAllRead();
      expect(result.count).toBe(1);

      // User 2 should still have unread
      const user2Count = await callerUser2.notifications.unreadCount();
      expect(user2Count).toBe(1);
    });
  });
});
