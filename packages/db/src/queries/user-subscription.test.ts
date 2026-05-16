import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { userSubscriptions, users } from "../schema";
import { closePGliteDb, makePGliteDb } from "../testing";
import { getUserIdsPastDue, getUserSubscription } from "./index";

const USER_A = "sub-user-a";
const USER_B = "sub-user-b";
let testDb: Awaited<ReturnType<typeof makePGliteDb>>["db"];

describe("user subscription queries", () => {
  beforeAll(async () => {
    const bundle = await makePGliteDb();
    testDb = bundle.db;
  });

  beforeEach(async () => {
    await testDb.delete(userSubscriptions);
    await testDb.delete(users);
    await testDb.insert(users).values([
      { id: USER_A, email: "a@example.com", name: "User A" },
      { id: USER_B, email: "b@example.com", name: "User B" },
    ]);
  });

  afterAll(async () => {
    await closePGliteDb();
  });

  it("defaults to free and self-heals a missing subscription row", async () => {
    const sub = await getUserSubscription(USER_A);

    expect(sub.plan).toBe("free");
    expect(sub.planQuota).toBe(5);
    expect(sub.endsAt).toBeNull();

    // Self-heal: the row should now exist so later reads/writes are stable.
    const rows = await testDb.select().from(userSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(USER_A);
    expect(rows[0]?.tier).toBe("free");
  });

  it("returns the stored tier and quota for an existing row", async () => {
    await testDb.insert(userSubscriptions).values({ userId: USER_A, tier: "pro" });

    const sub = await getUserSubscription(USER_A);
    expect(sub.plan).toBe("pro");
    expect(sub.planQuota).toBe(100);
  });

  it("getUserIdsPastDue returns only pro users whose endsAt has elapsed", async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const future = new Date(Date.now() + 60 * 60 * 1000);

    await testDb.insert(userSubscriptions).values([
      // pro + endsAt in the past → past due (should be returned)
      { userId: USER_A, tier: "pro", endsAt: past },
      // pro + endsAt in the future → still within paid period (excluded)
      { userId: USER_B, tier: "pro", endsAt: future },
    ]);

    const pastDue = await getUserIdsPastDue();
    expect(pastDue).toEqual([USER_A]);
  });

  it("getUserIdsPastDue excludes already-downgraded (free) users", async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    await testDb.insert(userSubscriptions).values({ userId: USER_A, tier: "free", endsAt: past });

    expect(await getUserIdsPastDue()).toEqual([]);
  });
});
