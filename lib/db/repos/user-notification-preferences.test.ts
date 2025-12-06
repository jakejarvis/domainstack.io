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
import { userNotificationPreferences, users } from "@/lib/db/schema";
import {
  getOrCreateUserNotificationPreferences,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "./user-notification-preferences";

let testUserId: string;

beforeAll(async () => {
  // Create a test user
  const insertedUser = await db
    .insert(users)
    .values({
      id: "test-notif-prefs-user-123",
      name: "Test Notif Prefs User",
      email: "notifprefs@example.com",
      emailVerified: true,
    })
    .returning();
  testUserId = insertedUser[0].id;
});

afterAll(async () => {
  const { closePGliteDb } = await import("@/lib/db/pglite");
  await closePGliteDb();
});

beforeEach(async () => {
  // Clear notification preferences before each test
  await db.delete(userNotificationPreferences);
});

describe("getOrCreateUserNotificationPreferences", () => {
  it("creates new preferences with defaults when none exist", async () => {
    const result = await getOrCreateUserNotificationPreferences(testUserId);

    // Returns only the preference booleans, not the full DB record
    expect(result.domainExpiry).toBe(true);
    expect(result.certificateExpiry).toBe(true);
    expect(result.verificationStatus).toBe(true);
  });

  it("returns existing preferences without creating new ones", async () => {
    // Create custom preferences first
    await db.insert(userNotificationPreferences).values({
      userId: testUserId,
      domainExpiry: false,
      certificateExpiry: true,
      verificationStatus: false,
    });

    const result = await getOrCreateUserNotificationPreferences(testUserId);

    expect(result.domainExpiry).toBe(false);
    expect(result.certificateExpiry).toBe(true);
    expect(result.verificationStatus).toBe(false);
  });

  it("returns consistent values on multiple calls", async () => {
    const first = await getOrCreateUserNotificationPreferences(testUserId);
    const second = await getOrCreateUserNotificationPreferences(testUserId);

    expect(first.domainExpiry).toBe(second.domainExpiry);
    expect(first.certificateExpiry).toBe(second.certificateExpiry);
    expect(first.verificationStatus).toBe(second.verificationStatus);
  });
});

describe("getUserNotificationPreferences", () => {
  it("returns null when preferences do not exist", async () => {
    const result = await getUserNotificationPreferences(testUserId);
    expect(result).toBeNull();
  });

  it("returns existing preferences", async () => {
    await db.insert(userNotificationPreferences).values({
      userId: testUserId,
      domainExpiry: true,
      certificateExpiry: false,
      verificationStatus: true,
    });

    const result = await getUserNotificationPreferences(testUserId);

    expect(result).not.toBeNull();
    expect(result?.domainExpiry).toBe(true);
    expect(result?.certificateExpiry).toBe(false);
    expect(result?.verificationStatus).toBe(true);
  });
});

describe("updateUserNotificationPreferences", () => {
  it("updates single preference", async () => {
    await getOrCreateUserNotificationPreferences(testUserId);

    const result = await updateUserNotificationPreferences(testUserId, {
      domainExpiry: false,
    });

    expect(result?.domainExpiry).toBe(false);
    expect(result?.certificateExpiry).toBe(true); // Unchanged
    expect(result?.verificationStatus).toBe(true); // Unchanged
  });

  it("updates multiple preferences", async () => {
    await getOrCreateUserNotificationPreferences(testUserId);

    const result = await updateUserNotificationPreferences(testUserId, {
      domainExpiry: false,
      certificateExpiry: false,
    });

    expect(result?.domainExpiry).toBe(false);
    expect(result?.certificateExpiry).toBe(false);
    expect(result?.verificationStatus).toBe(true); // Unchanged
  });

  it("updates all preferences", async () => {
    await getOrCreateUserNotificationPreferences(testUserId);

    const result = await updateUserNotificationPreferences(testUserId, {
      domainExpiry: false,
      certificateExpiry: false,
      verificationStatus: false,
    });

    expect(result?.domainExpiry).toBe(false);
    expect(result?.certificateExpiry).toBe(false);
    expect(result?.verificationStatus).toBe(false);
  });

  it("creates preferences if they do not exist", async () => {
    // Don't create preferences first
    const result = await updateUserNotificationPreferences(testUserId, {
      domainExpiry: false,
    });

    expect(result.domainExpiry).toBe(false);
    expect(result.certificateExpiry).toBe(true); // Default
    expect(result.verificationStatus).toBe(true); // Default
  });

  it("persists changes to database", async () => {
    await getOrCreateUserNotificationPreferences(testUserId);

    await updateUserNotificationPreferences(testUserId, {
      domainExpiry: false,
    });

    // Verify via direct query
    const stored = await getUserNotificationPreferences(testUserId);
    expect(stored?.domainExpiry).toBe(false);
  });
});
