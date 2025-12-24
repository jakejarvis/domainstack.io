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
      email: "notif@example.com",
      emailVerified: true,
    })
    .returning();
  testUserId = insertedUser[0].id;

  // Create a test domain
  const insertedDomain = await db
    .insert(domains)
    .values({
      name: "notif-test.com",
      tld: "com",
      unicodeName: "notif-test.com",
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
    expect(result?.userId).toBe(testUserId);
    expect(result?.trackedDomainId).toBe(testTrackedDomainId);
    expect(result?.type).toBe("domain_expiry_30d");
    expect(result?.title).toBe("Domain expiring soon");
    expect(result?.message).toBe("Your domain expires in 30 days");
    expect(result?.sentAt).toBeInstanceOf(Date);
    expect(result?.readAt).toBeNull();
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
      data: { domainName: "notif-test.com", url: "/dashboard" },
    });

    expect(result?.data).toEqual({
      domainName: "notif-test.com",
      url: "/dashboard",
      channels: ["in-app", "email"],
    });
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

    expect(notif?.readAt).toBeNull();

    if (!notif) throw new Error("Notification not created");

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
