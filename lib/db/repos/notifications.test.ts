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
  notifications,
  trackedDomains,
  userLimits,
  users,
} from "@/lib/db/schema";
import {
  clearCertificateExpiryNotifications,
  clearDomainExpiryNotifications,
  createNotification,
  deleteNotificationsForTrackedDomain,
  getNotificationsForTrackedDomain,
  hasNotificationBeenSent,
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
      name: "notif-test.com",
      tld: "com",
      unicodeName: "notif-test.com",
    })
    .returning();
  testDomainId = insertedDomain[0].id;

  // Create a tracked domain
  const insertedTracked = await db
    .insert(trackedDomains)
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
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    expect(result).not.toBeNull();
    expect(result?.trackedDomainId).toBe(testTrackedDomainId);
    expect(result?.type).toBe("domain_expiry_30d");
    expect(result?.sentAt).toBeInstanceOf(Date);
  });

  it("returns existing notification on duplicate (idempotent)", async () => {
    // Create first
    const first = await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    // Create duplicate
    const second = await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    expect(second).not.toBeNull();
    expect(second?.id).toBe(first?.id);
  });

  it("creates different records for different notification types", async () => {
    const first = await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    const second = await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
    });

    expect(first?.id).not.toBe(second?.id);
  });
});

describe("hasNotificationBeenSent", () => {
  it("returns false when notification does not exist", async () => {
    const result = await hasNotificationBeenSent(
      testTrackedDomainId,
      "domain_expiry_30d",
    );
    expect(result).toBe(false);
  });

  it("returns true when notification exists", async () => {
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    const result = await hasNotificationBeenSent(
      testTrackedDomainId,
      "domain_expiry_30d",
    );
    expect(result).toBe(true);
  });

  it("returns false for different notification type", async () => {
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    const result = await hasNotificationBeenSent(
      testTrackedDomainId,
      "domain_expiry_14d",
    );
    expect(result).toBe(false);
  });
});

describe("updateNotificationResendId", () => {
  it("updates resend ID for existing notification", async () => {
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    const result = await updateNotificationResendId(
      testTrackedDomainId,
      "domain_expiry_30d",
      "resend-id-123",
    );

    expect(result).toBe(true);

    // Verify update
    const notifs = await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(notifs[0].resendId).toBe("resend-id-123");
  });

  it("returns true even when notification does not exist (no-op update)", async () => {
    // Note: The function returns true if no error occurred, even if no rows matched
    const result = await updateNotificationResendId(
      testTrackedDomainId,
      "domain_expiry_30d",
      "resend-id-123",
    );

    expect(result).toBe(true);
  });
});

describe("getNotificationsForTrackedDomain", () => {
  it("returns empty array when no notifications exist", async () => {
    const result = await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(result).toEqual([]);
  });

  it("returns all notifications for tracked domain", async () => {
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
    });

    const result = await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(result).toHaveLength(2);
  });

  it("returns notifications ordered by sentAt", async () => {
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
    });

    const result = await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(result[0].type).toBe("domain_expiry_30d");
    expect(result[1].type).toBe("domain_expiry_14d");
  });
});

describe("deleteNotificationsForTrackedDomain", () => {
  it("deletes all notifications for tracked domain", async () => {
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
    });

    const result =
      await deleteNotificationsForTrackedDomain(testTrackedDomainId);
    expect(result).toBe(true);

    const remaining =
      await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(remaining).toHaveLength(0);
  });

  it("returns true even when no notifications exist (no-op)", async () => {
    const result =
      await deleteNotificationsForTrackedDomain(testTrackedDomainId);
    expect(result).toBe(true);
  });
});

describe("clearDomainExpiryNotifications", () => {
  it("clears only domain_expiry_* notifications", async () => {
    // Create domain expiry notifications
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_14d",
    });
    // Create a non-domain-expiry notification
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "verification_failing",
    });

    const cleared = await clearDomainExpiryNotifications(testTrackedDomainId);
    expect(cleared).toBe(2);

    const remaining =
      await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("verification_failing");
  });

  it("returns 0 when no domain expiry notifications exist", async () => {
    const cleared = await clearDomainExpiryNotifications(testTrackedDomainId);
    expect(cleared).toBe(0);
  });

  it("returns 0 when only non-domain-expiry notifications exist", async () => {
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "certificate_expiry_14d",
    });

    const cleared = await clearDomainExpiryNotifications(testTrackedDomainId);
    expect(cleared).toBe(0);

    const remaining =
      await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(remaining).toHaveLength(1);
  });
});

describe("clearCertificateExpiryNotifications", () => {
  it("clears only certificate_expiry_* notifications", async () => {
    // Create certificate expiry notifications
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "certificate_expiry_14d",
    });
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "certificate_expiry_7d",
    });
    // Create a non-certificate-expiry notification
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    const cleared =
      await clearCertificateExpiryNotifications(testTrackedDomainId);
    expect(cleared).toBe(2);

    const remaining =
      await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("domain_expiry_30d");
  });

  it("returns 0 when no certificate expiry notifications exist", async () => {
    const cleared =
      await clearCertificateExpiryNotifications(testTrackedDomainId);
    expect(cleared).toBe(0);
  });

  it("returns 0 when only non-certificate-expiry notifications exist", async () => {
    await createNotification({
      trackedDomainId: testTrackedDomainId,
      type: "domain_expiry_30d",
    });

    const cleared =
      await clearCertificateExpiryNotifications(testTrackedDomainId);
    expect(cleared).toBe(0);

    const remaining =
      await getNotificationsForTrackedDomain(testTrackedDomainId);
    expect(remaining).toHaveLength(1);
  });
});
