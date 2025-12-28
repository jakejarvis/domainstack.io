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
      email: "notifprefs@example.test",
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

    // Returns objects with channel booleans
    expect(result.domainExpiry).toEqual({ inApp: true, email: true });
    expect(result.certificateExpiry).toEqual({ inApp: true, email: true });
    expect(result.registrationChanges).toEqual({ inApp: true, email: true });
    expect(result.providerChanges).toEqual({ inApp: true, email: true });
    expect(result.certificateChanges).toEqual({ inApp: true, email: true });
  });

  it("returns existing preferences without creating new ones", async () => {
    // Create custom preferences first
    await db.insert(userNotificationPreferences).values({
      userId: testUserId,
      domainExpiry: { inApp: false, email: false },
      certificateExpiry: { inApp: true, email: true },
      registrationChanges: { inApp: false, email: true },
      providerChanges: { inApp: true, email: false },
      certificateChanges: { inApp: false, email: false },
    });

    const result = await getOrCreateUserNotificationPreferences(testUserId);

    expect(result.domainExpiry).toEqual({ inApp: false, email: false });
    expect(result.certificateExpiry).toEqual({ inApp: true, email: true });
    expect(result.registrationChanges).toEqual({ inApp: false, email: true });
    expect(result.providerChanges).toEqual({ inApp: true, email: false });
    expect(result.certificateChanges).toEqual({ inApp: false, email: false });
  });

  it("returns consistent values on multiple calls", async () => {
    const first = await getOrCreateUserNotificationPreferences(testUserId);
    const second = await getOrCreateUserNotificationPreferences(testUserId);

    expect(first.domainExpiry).toEqual(second.domainExpiry);
    expect(first.certificateExpiry).toEqual(second.certificateExpiry);
    expect(first.registrationChanges).toEqual(second.registrationChanges);
    expect(first.providerChanges).toEqual(second.providerChanges);
    expect(first.certificateChanges).toEqual(second.certificateChanges);
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
      domainExpiry: { inApp: true, email: true },
      certificateExpiry: { inApp: false, email: true },
      registrationChanges: { inApp: true, email: false },
      providerChanges: { inApp: false, email: false },
      certificateChanges: { inApp: true, email: false },
    });

    const result = await getUserNotificationPreferences(testUserId);

    expect(result).not.toBeNull();
    expect(result?.domainExpiry).toEqual({ inApp: true, email: true });
    expect(result?.certificateExpiry).toEqual({ inApp: false, email: true });
    expect(result?.registrationChanges).toEqual({ inApp: true, email: false });
    expect(result?.providerChanges).toEqual({ inApp: false, email: false });
    expect(result?.certificateChanges).toEqual({ inApp: true, email: false });
  });
});

describe("updateUserNotificationPreferences", () => {
  it("updates single preference", async () => {
    await getOrCreateUserNotificationPreferences(testUserId);

    const result = await updateUserNotificationPreferences(testUserId, {
      domainExpiry: { inApp: false, email: true },
    });

    expect(result?.domainExpiry).toEqual({ inApp: false, email: true });
    expect(result?.certificateExpiry).toEqual({ inApp: true, email: true }); // Unchanged
    expect(result?.registrationChanges).toEqual({ inApp: true, email: true }); // Unchanged
  });

  it("updates multiple preferences", async () => {
    await getOrCreateUserNotificationPreferences(testUserId);

    const result = await updateUserNotificationPreferences(testUserId, {
      domainExpiry: { inApp: false, email: false },
      certificateExpiry: { inApp: false, email: true },
    });

    expect(result?.domainExpiry).toEqual({ inApp: false, email: false });
    expect(result?.certificateExpiry).toEqual({ inApp: false, email: true });
    expect(result?.registrationChanges).toEqual({ inApp: true, email: true }); // Unchanged
  });

  it("updates all preferences", async () => {
    await getOrCreateUserNotificationPreferences(testUserId);

    const result = await updateUserNotificationPreferences(testUserId, {
      domainExpiry: { inApp: false, email: false },
      certificateExpiry: { inApp: false, email: true },
      registrationChanges: { inApp: false, email: false },
      providerChanges: { inApp: false, email: true },
      certificateChanges: { inApp: false, email: false },
    });

    expect(result?.domainExpiry).toEqual({ inApp: false, email: false });
    expect(result?.certificateExpiry).toEqual({ inApp: false, email: true });
    expect(result?.registrationChanges).toEqual({ inApp: false, email: false });
    expect(result?.providerChanges).toEqual({ inApp: false, email: true });
    expect(result?.certificateChanges).toEqual({ inApp: false, email: false });
  });

  it("creates preferences if they do not exist", async () => {
    // Don't create preferences first
    const result = await updateUserNotificationPreferences(testUserId, {
      domainExpiry: { inApp: false, email: true },
    });

    expect(result.domainExpiry).toEqual({ inApp: false, email: true });
    expect(result.certificateExpiry).toEqual({ inApp: true, email: true }); // Default
    expect(result.registrationChanges).toEqual({ inApp: true, email: true }); // Default
  });

  it("persists changes to database", async () => {
    await getOrCreateUserNotificationPreferences(testUserId);

    await updateUserNotificationPreferences(testUserId, {
      domainExpiry: { inApp: false, email: false },
    });

    // Verify via direct query
    const stored = await getUserNotificationPreferences(testUserId);
    expect(stored?.domainExpiry).toEqual({ inApp: false, email: false });
  });
});
