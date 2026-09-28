/* @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Initialize PGlite before importing anything that uses the db
const { makePGliteDb, closePGliteDb } = await import("@domainstack/db/testing");
const { db } = await makePGliteDb();

const { domains, notifications, users, userTrackedDomains } =
  await import("@domainstack/db/schema");
const { eq } = await import("@domainstack/db/drizzle");
const { createNotification } = await import("@domainstack/db/queries/notifications");

const TEST_USER_ID = "test-user-id-12345";
const TEST_DOMAIN_ID = "a0000000-0000-1000-a000-000000000001";
const TEST_TRACKED_ID = "b0000000-0000-1000-a000-000000000010";

const baseParams = {
  userId: TEST_USER_ID,
  trackedDomainId: TEST_TRACKED_ID,
  type: "domain_expiry_7d" as const,
  title: "example.com expires in 7 days",
  message: "Your domain example.com will expire soon.",
  channels: ["in-app" as const],
};

beforeAll(async () => {
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
    })
    .onConflictDoNothing();

  await db
    .insert(domains)
    .values({ id: TEST_DOMAIN_ID, name: "example.com", tld: "com", unicodeName: "example.com" })
    .onConflictDoNothing();

  await db
    .insert(userTrackedDomains)
    .values({
      id: TEST_TRACKED_ID,
      userId: TEST_USER_ID,
      domainId: TEST_DOMAIN_ID,
      verified: true,
      verificationToken: "test-token",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await closePGliteDb();
});

describe("createNotification", () => {
  it("returns one row and one loser for concurrent calls with the same dedupe key", async () => {
    const dedupeKey = "domain-expiry:concurrent:2026-10-05T00:00:00.000Z:domain_expiry_7d";

    const results = await Promise.all([
      createNotification({ ...baseParams, dedupeKey }),
      createNotification({ ...baseParams, dedupeKey }),
    ]);

    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results.filter((r) => !r.created)).toHaveLength(1);
    expect(results[0].notification?.id).toBeDefined();
    expect(results[0].notification?.id).toBe(results[1].notification?.id);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.dedupeKey, dedupeKey));
    expect(rows).toHaveLength(1);
  });

  it("returns the existing row with created: false for a sequential repeat", async () => {
    const dedupeKey = "domain-expiry:sequential:2026-10-05T00:00:00.000Z:domain_expiry_7d";

    const first = await createNotification({ ...baseParams, dedupeKey });
    const second = await createNotification({ ...baseParams, dedupeKey, title: "different title" });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.notification?.id).toBe(first.notification?.id);
    expect(second.notification?.title).toBe(baseParams.title);
  });

  it("creates separate rows for different dedupe keys", async () => {
    const a = await createNotification({ ...baseParams, dedupeKey: "key-a" });
    const b = await createNotification({ ...baseParams, dedupeKey: "key-b" });

    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(a.notification?.id).not.toBe(b.notification?.id);
    expect(a.notification?.dedupeKey).toBe("key-a");
  });

  it("creates separate rows for unkeyed calls", async () => {
    const a = await createNotification(baseParams);
    const b = await createNotification(baseParams);

    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(a.notification?.id).not.toBe(b.notification?.id);
    expect(a.notification?.dedupeKey).toBeNull();
    expect(b.notification?.dedupeKey).toBeNull();
  });
});
