import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { domains, notifications, users, userTrackedDomains } from "../schema";
import { closePGliteDb, makePGliteDb } from "../testing";
import { createNotification, hasRecentNotification } from "./index";

const USER_ID = "notif-test-user";
let testDb: Awaited<ReturnType<typeof makePGliteDb>>["db"];
let trackedDomainId: string;

describe("hasRecentNotification", () => {
  beforeAll(async () => {
    const bundle = await makePGliteDb();
    testDb = bundle.db;
  });

  beforeEach(async () => {
    await testDb.delete(notifications);
    await testDb.delete(userTrackedDomains);
    await testDb.delete(domains);
    await testDb.delete(users);

    await testDb.insert(users).values({
      id: USER_ID,
      email: "notif@example.com",
      name: "Notif Tester",
    });
    const [domain] = await testDb
      .insert(domains)
      .values({ name: "example.com", tld: "com", unicodeName: "example.com" })
      .returning();
    const [tracked] = await testDb
      .insert(userTrackedDomains)
      .values({ userId: USER_ID, domainId: domain!.id, verificationToken: "tok" })
      .returning();
    trackedDomainId = tracked!.id;
  });

  afterAll(async () => {
    await closePGliteDb();
  });

  it("treats a recent email notification as sent even with no resendId", async () => {
    await createNotification({
      userId: USER_ID,
      trackedDomainId,
      type: "domain_expiry_7d",
      title: "t",
      message: "m",
      channels: ["in-app", "email"],
      // no resendId — previously this caused infinite re-fire
    });

    await expect(hasRecentNotification(trackedDomainId, "domain_expiry_7d")).resolves.toBe(true);
  });

  it("returns false when there is no matching recent notification", async () => {
    await expect(hasRecentNotification(trackedDomainId, "domain_expiry_7d")).resolves.toBe(false);
  });

  it("ignores notifications outside the recent window", async () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await testDb.insert(notifications).values({
      userId: USER_ID,
      trackedDomainId,
      type: "domain_expiry_7d",
      title: "t",
      message: "m",
      channels: ["in-app", "email"],
      sentAt: old,
    });

    await expect(hasRecentNotification(trackedDomainId, "domain_expiry_7d", 30)).resolves.toBe(
      false,
    );
  });
});
