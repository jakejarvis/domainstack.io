/* @vitest-environment node */
import { eq } from "drizzle-orm";
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
  notifications,
  users,
  userTrackedDomains,
} from "@/lib/db/schema";
import {
  clearCertificateExpiryNotifications,
  clearDomainExpiryNotifications,
  createNotification,
  deleteNotificationsForTrackedDomain,
  getNotificationsForTrackedDomain,
  getUnreadCount,
  getUserNotifications,
  hasRecentNotification,
  markAllAsRead,
  markAsRead,
  updateNotificationResendId,
} from "./notifications";

let testUserId: string;
let testDomainId: string;
let testTrackedDomainId: string;

beforeAll(async () => {
  // Create a test user
  const insertedUser = await db
    .insert(users)
    .values({
      id: "test-notif-user-123",
      name: "Test Notif User",
      email: "notif@example.test",
      emailVerified: true,
    })
    .returning();
  testUserId = insertedUser[0].id;

  // Create a test domain
  const insertedDomain = await db
    .insert(domains)
    .values({
      name: "notif.test",
      tld: "test",
      unicodeName: "notif.test",
    })
    .returning();
  testDomainId = insertedDomain[0].id;

  // Create a tracked domain
  const insertedTracked = await db
    .insert(userTrackedDomains)
    .values({
      userId: testUserId,
      domainId: testDomainId,
      verificationToken: "test-token",
    })
    .returning();
  testTrackedDomainId = insertedTracked[0].id;
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

beforeEach(async () => {
  // Clear notifications before each test
  await db.delete(notifications);
});

describe("createNotification", () => {
  it("creates a new notification record", async () => {
    const result = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Domain expiring soon",
      message: "Your domain expires in 30 days",
    });

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected result");

    expect(result.userId).toBe(testUserId);
    expect(result.trackedDomainId).toBe(testTrackedDomainId);
    expect(result.type).toBe("domain_expiry_30d");
    expect(result.title).toBe("Domain expiring soon");
    expect(result.message).toBe("Your domain expires in 30 days");
    expect(result.sentAt).toBeInstanceOf(Date);
    expect(result.readAt).toBeNull();
  });

  it("creates multiple notifications of same type (history)", async () => {
    const first = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Domain expiring soon",
      message: "Your domain expires in 30 days",
    });

    const second = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Domain expiring soon",
      message: "Your domain expires in 30 days",
    });

    expect(first?.id).not.toBe(second?.id);
  });

  it("stores data field for actionable notifications", async () => {
    const result = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Domain expiring soon",
      message: "Your domain expires in 30 days",
      data: { domainName: "notif.test", url: "/dashboard" },
    });

    expect(result).not.toBeNull();
    if (!result) throw new Error("Expected result");

    expect(result.data).toEqual({
      domainName: "notif.test",
      url: "/dashboard",
    });
    expect(result.channels).toEqual(["in-app", "email"]);
  });
});

describe("getUserNotifications", () => {
  it("returns notifications for user ordered by sentAt desc", async () => {
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "First notification",
      message: "Message 1",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
      title: "Second notification",
      message: "Message 2",
    });

    const result = await getUserNotifications(testUserId);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Second notification");
    expect(result[1].title).toBe("First notification");
  });

  it("respects limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await createNotification({
        userId: testUserId,
        trackedDomainId: testTrackedDomainId,
        type: "domain_expiry_30d",
        title: `Notification ${i}`,
        message: `Message ${i}`,
      });
    }

    const result = await getUserNotifications(testUserId, 3);
    expect(result).toHaveLength(3);
  });

  it("handles pagination with identical timestamps", async () => {
    const fixedDate = new Date("2024-01-01T12:00:00Z");

    // Insert 5 notifications with the exact same timestamp
    // Since IDs are random UUIDs, their sort order will be deterministic but random relative to insertion order
    // We'll rely on the returned list to get the cursor
    const createdIds: string[] = [];

    for (let i = 0; i < 5; i++) {
      const [n] = await db
        .insert(notifications)
        .values({
          userId: testUserId,
          type: "domain_expiry_30d",
          title: `Notification ${i}`,
          message: `Message ${i}`,
          sentAt: fixedDate,
          channels: ["in-app"],
          data: {},
        })
        .returning();
      createdIds.push(n.id);
    }

    // Get first page (limit 3)
    const page1 = await getUserNotifications(testUserId, 3);
    expect(page1).toHaveLength(3);

    // Get second page using last item of page 1 as cursor
    const cursor = page1[page1.length - 1].id;
    const page2 = await getUserNotifications(testUserId, 3, cursor);

    expect(page2).toHaveLength(2);

    // Ensure no overlap or gaps
    const allIds = [...page1.map((n) => n.id), ...page2.map((n) => n.id)];
    expect(new Set(allIds).size).toBe(5);

    // Verify sorting (should be by ID desc since timestamps are equal)
    for (let i = 0; i < allIds.length - 1; i++) {
      const curr = allIds[i];
      const next = allIds[i + 1];
      // Check that we are correctly sorted by ID (desc) since timestamps are equal
      expect(curr > next).toBe(true); // String comparison of UUIDs
    }
  });

  it("filters unread notifications when filter is 'unread'", async () => {
    // Create mix of read and unread notifications
    const unread1 = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Unread 1",
      message: "Message 1",
    });

    const read1 = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
      title: "Read 1",
      message: "Message 2",
    });

    const unread2 = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "certificate_expiry_14d",
      title: "Unread 2",
      message: "Message 3",
    });

    // Mark one as read
    if (read1) {
      await markAsRead(read1.id, testUserId);
    }

    // Get all notifications (default behavior)
    const allNotifications = await getUserNotifications(testUserId, 50);
    expect(allNotifications).toHaveLength(3);

    // Get only unread notifications
    const unreadNotifications = await getUserNotifications(
      testUserId,
      50,
      undefined,
      "unread",
    );
    expect(unreadNotifications).toHaveLength(2);
    expect(unreadNotifications.map((n) => n.id).sort()).toEqual(
      [unread1?.id, unread2?.id].sort(),
    );
  });

  it("filters unread notifications with cursor pagination", async () => {
    // Create multiple unread and read notifications
    const notifs = [];
    for (let i = 0; i < 5; i++) {
      const notif = await createNotification({
        userId: testUserId,
        trackedDomainId: testTrackedDomainId,
        type: "domain_expiry_30d",
        title: `Notification ${i}`,
        message: `Message ${i}`,
      });
      notifs.push(notif);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Mark alternating notifications as read (0, 2, 4)
    for (let i = 0; i < 5; i += 2) {
      const notif = notifs[i];
      if (notif) {
        await markAsRead(notif.id, testUserId);
      }
    }

    // Get first page of unread notifications (limit 1)
    const page1 = await getUserNotifications(
      testUserId,
      1,
      undefined,
      "unread",
    );
    expect(page1).toHaveLength(1);
    expect(page1[0].readAt).toBeNull();

    // Get second page using cursor
    const cursor = page1[0].id;
    const page2 = await getUserNotifications(testUserId, 2, cursor, "unread");
    expect(page2).toHaveLength(1); // Only 1 more unread notification
    expect(page2[0].readAt).toBeNull();

    // Verify we got exactly 2 unread notifications
    // Since notifications are ordered by sentAt DESC, the most recent unread should be first
    const allUnreadIds = [...page1, ...page2].map((n) => n.id);
    const expectedUnreadIds = [notifs[3]?.id, notifs[1]?.id]; // Unread notifications in DESC order (3, 1)

    // Sort both arrays for comparison since UUID ordering might differ
    expect(allUnreadIds.sort()).toEqual(expectedUnreadIds.sort());
  });

  it("filters read notifications when filter is 'read'", async () => {
    // Create mix of read and unread notifications
    const notif1 = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Notification 1",
      message: "Message 1",
    });

    const _notif2 = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
      title: "Notification 2",
      message: "Message 2",
    });

    const notif3 = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "certificate_expiry_14d",
      title: "Notification 3",
      message: "Message 3",
    });

    // Mark two as read
    if (notif1 && notif3) {
      await markAsRead(notif1.id, testUserId);
      await markAsRead(notif3.id, testUserId);
    }

    // Get only read notifications (archive view)
    const readNotifications = await getUserNotifications(
      testUserId,
      50,
      undefined,
      "read",
    );
    expect(readNotifications).toHaveLength(2);
    expect(readNotifications.every((n) => n.readAt !== null)).toBe(true);
    expect(readNotifications.map((n) => n.id).sort()).toEqual(
      [notif1?.id, notif3?.id].sort(),
    );
  });
});

describe("getUnreadCount", () => {
  it("returns 0 when no notifications exist", async () => {
    const count = await getUnreadCount(testUserId);
    expect(count).toBe(0);
  });

  it("returns count of unread notifications", async () => {
    const notif1 = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Unread 1",
      message: "Message 1",
    });

    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
      title: "Unread 2",
      message: "Message 2",
    });

    // Mark one as read
    if (notif1) {
      await markAsRead(notif1.id, testUserId);
    }

    const count = await getUnreadCount(testUserId);
    expect(count).toBe(1);
  });
});

describe("markAsRead", () => {
  it("marks notification as read", async () => {
    const notif = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Test notification",
      message: "Test message",
    });

    expect(notif).not.toBeNull();
    if (!notif) throw new Error("Notification not created");

    expect(notif.readAt).toBeNull();

    const success = await markAsRead(notif.id, testUserId);
    expect(success).toBe(true);

    const [updated] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notif.id));

    expect(updated.readAt).toBeInstanceOf(Date);
  });

  it("returns false for non-existent notification", async () => {
    const success = await markAsRead("non-existent-id", testUserId);
    expect(success).toBe(false);
  });

  it("returns false when userId does not match", async () => {
    const notif = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Test notification",
      message: "Test message",
    });

    if (!notif) throw new Error("Notification not created");

    const success = await markAsRead(notif.id, "different-user-id");
    expect(success).toBe(false);
  });
});

describe("markAllAsRead", () => {
  it("marks all unread notifications as read", async () => {
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Notification 1",
      message: "Message 1",
    });

    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
      title: "Notification 2",
      message: "Message 2",
    });

    const count = await markAllAsRead(testUserId);
    expect(count).toBe(2);

    const unreadCount = await getUnreadCount(testUserId);
    expect(unreadCount).toBe(0);
  });

  it("returns 0 when no unread notifications exist", async () => {
    const count = await markAllAsRead(testUserId);
    expect(count).toBe(0);
  });
});

describe("hasRecentNotification", () => {
  it("returns false when notification does not exist", async () => {
    const result = await hasRecentNotification(
      testTrackedDomainId,
      "domain_expiry_30d",
    );
    expect(result).toBe(false);
  });

  it("returns true when recent notification exists", async () => {
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Test notification",
      message: "Test message",
    });

    const result = await hasRecentNotification(
      testTrackedDomainId,
      "domain_expiry_30d",
    );
    expect(result).toBe(true);
  });

  it("returns false for old notifications beyond cutoff", async () => {
    // Create a notification with a date 31 days ago
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 31);

    await db.insert(notifications).values({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Old notification",
      message: "Old message",
      sentAt: oldDate,
    });

    const result = await hasRecentNotification(
      testTrackedDomainId,
      "domain_expiry_30d",
      30,
    );
    expect(result).toBe(false);
  });
});

describe("updateNotificationResendId", () => {
  it("updates resend ID for existing notification", async () => {
    const notif = await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Test notification",
      message: "Test message",
    });

    if (!notif) throw new Error("Notification not created");

    const result = await updateNotificationResendId(notif.id, "resend-id-123");

    expect(result).toBe(true);

    const [updated] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notif.id));

    expect(updated.resendId).toBe("resend-id-123");
  });
});

describe("getNotificationsForTrackedDomain", () => {
  it("returns empty array when no notifications exist", async () => {
    const result = await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(result).toEqual([]);
  });

  it("returns all notifications for tracked domain", async () => {
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Notification 1",
      message: "Message 1",
    });
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
      title: "Notification 2",
      message: "Message 2",
    });

    const result = await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(result).toHaveLength(2);
  });
});

describe("deleteNotificationsForTrackedDomain", () => {
  it("deletes all notifications for tracked domain", async () => {
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Notification 1",
      message: "Message 1",
    });
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
      title: "Notification 2",
      message: "Message 2",
    });

    const result =
      await deleteNotificationsForTrackedDomain(testTrackedDomainId);
    expect(result).toBe(true);

    const remaining =
      await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(remaining).toHaveLength(0);
  });
});

describe("clearDomainExpiryNotifications", () => {
  it("clears only domain_expiry_* notifications", async () => {
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Expiry 30",
      message: "Message",
    });
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
      title: "Expiry 14",
      message: "Message",
    });
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "verification_failing",
      title: "Verification failing",
      message: "Message",
    });

    const cleared = await clearDomainExpiryNotifications(testTrackedDomainId);
    expect(cleared).toBe(2);

    const remaining =
      await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("verification_failing");
  });
});

describe("clearCertificateExpiryNotifications", () => {
  it("clears only certificate_expiry_* notifications", async () => {
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "certificate_expiry_14d",
      title: "Cert expiry 14",
      message: "Message",
    });
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "certificate_expiry_7d",
      title: "Cert expiry 7",
      message: "Message",
    });
    await createNotification({
      userId: testUserId,
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
      title: "Domain expiry 30",
      message: "Message",
    });

    const cleared =
      await clearCertificateExpiryNotifications(testTrackedDomainId);
    expect(cleared).toBe(2);

    const remaining =
      await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("domain_expiry_30d");
  });
});
