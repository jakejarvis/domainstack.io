import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  billingSubscriptions,
  domains,
  userSubscriptions,
  users,
  userTrackedDomains,
} from "../schema";
import { closePGliteDb, makePGliteDb } from "../testing";
import {
  getUserIdsPastDue,
  getUserSubscription,
  recomputeEntitlement,
  setLastExpiryNotification,
  upsertBillingSubscription,
} from "./index";

const USER_A = "sub-user-a";
const USER_B = "sub-user-b";
let testDb: Awaited<ReturnType<typeof makePGliteDb>>["db"];

const future = () => new Date(Date.now() + 60 * 60 * 1000);
const past = () => new Date(Date.now() - 60 * 60 * 1000);

async function seedPolarRow(
  userId: string,
  status: "active" | "canceling" | "expired" | "incomplete",
  currentPeriodEnd: Date | null = null,
  provider: "polar" | "apple" = "polar",
) {
  await testDb.insert(billingSubscriptions).values({
    userId,
    provider,
    providerSubscriptionId: `${provider}:${userId}`,
    externalId: userId,
    productId: null,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd: status === "canceling",
  });
}

async function seedTrackedDomains(userId: string, n: number) {
  const base = new Date("2024-01-01T00:00:00Z");
  for (let i = 0; i < n; i++) {
    const [d] = await testDb
      .insert(domains)
      .values({ name: `r-${userId}-${i}.com`, tld: "com", unicodeName: `r-${userId}-${i}.com` })
      .returning();
    await testDb.insert(userTrackedDomains).values({
      userId,
      domainId: d.id,
      verificationToken: `tok-${userId}-${i}`,
      verified: true,
      createdAt: new Date(base.getTime() + i * 86_400_000),
    });
  }
}

describe("user subscription queries", () => {
  beforeAll(async () => {
    const bundle = await makePGliteDb();
    testDb = bundle.db;
  });

  beforeEach(async () => {
    await testDb.delete(billingSubscriptions);
    await testDb.delete(userTrackedDomains);
    await testDb.delete(userSubscriptions);
    await testDb.delete(domains);
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

    const rows = await testDb.select().from(userSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tier).toBe("free");
  });

  it("returns the stored tier and quota for an existing row", async () => {
    await testDb.insert(userSubscriptions).values({ userId: USER_A, tier: "pro" });

    const sub = await getUserSubscription(USER_A);
    expect(sub.plan).toBe("pro");
    expect(sub.planQuota).toBe(100);
  });

  describe("recomputeEntitlement", () => {
    it("yields free with no billing rows and no cache row (no throw)", async () => {
      const result = await recomputeEntitlement(USER_A);

      expect(result).toEqual({
        plan: "free",
        endsAt: null,
        changed: false,
        upgraded: false,
        downgraded: false,
        archivedCount: 0,
      });
      const [row] = await testDb
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, USER_A));
      expect(row?.tier).toBe("free");
    });

    it("grants pro on a single active row, endsAt null", async () => {
      await seedPolarRow(USER_A, "active");

      const result = await recomputeEntitlement(USER_A);

      expect(result.plan).toBe("pro");
      expect(result.endsAt).toBeNull();
      expect(result.changed).toBe(true);
      expect(result.upgraded).toBe(true);
      expect(result.downgraded).toBe(false);
    });

    it("upgraded is true once on free→pro, false on a redelivered pro→pro recompute", async () => {
      await seedPolarRow(USER_A, "active");

      const first = await recomputeEntitlement(USER_A);
      expect(first.upgraded).toBe(true);

      // Webhook redelivery: same active row, already pro -> no transition.
      const replay = await recomputeEntitlement(USER_A);
      expect(replay.upgraded).toBe(false);
      expect(replay.changed).toBe(false);
    });

    it("grants pro on a future canceling row and preserves the reminder marker", async () => {
      const ends = future();
      await testDb
        .insert(userSubscriptions)
        .values({ userId: USER_A, tier: "pro", endsAt: ends, lastExpiryNotification: 3 });
      await seedPolarRow(USER_A, "canceling", ends);

      const result = await recomputeEntitlement(USER_A);

      expect(result.plan).toBe("pro");
      expect(result.endsAt?.getTime()).toBe(ends.getTime());
      const [row] = await testDb
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, USER_A));
      expect(row?.lastExpiryNotification).toBe(3);
    });

    it("is idempotent: repeated recomputes keep endsAt + marker stable", async () => {
      const ends = future();
      await seedPolarRow(USER_A, "canceling", ends);

      await recomputeEntitlement(USER_A);
      await setLastExpiryNotification(USER_A, 7);

      const r2 = await recomputeEntitlement(USER_A);
      const r3 = await recomputeEntitlement(USER_A);

      expect(r2.changed).toBe(false);
      expect(r3.changed).toBe(false);
      const [row] = await testDb
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, USER_A));
      expect(row?.endsAt?.getTime()).toBe(ends.getTime());
      expect(row?.lastExpiryNotification).toBe(7);
    });

    it("resets the reminder marker only when the cancellation cycle changes", async () => {
      const ends1 = future();
      await seedPolarRow(USER_A, "canceling", ends1);
      await recomputeEntitlement(USER_A);
      await setLastExpiryNotification(USER_A, 3);

      // Resubscribe -> active: endsAt cleared, marker reset.
      await upsertBillingSubscription(USER_A, {
        provider: "polar",
        externalId: USER_A,
        providerSubscriptionId: "polar:sub-a",
        productId: null,
        status: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      const afterResub = await recomputeEntitlement(USER_A);
      expect(afterResub.endsAt).toBeNull();
      let [row] = await testDb
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, USER_A));
      expect(row?.lastExpiryNotification).toBeNull();

      // Cancel again with a new period end -> new cycle, marker stays reset.
      const ends2 = new Date(ends1.getTime() + 86_400_000);
      await upsertBillingSubscription(USER_A, {
        provider: "polar",
        externalId: USER_A,
        providerSubscriptionId: "polar:sub-a",
        productId: null,
        status: "canceling",
        currentPeriodEnd: ends2,
        cancelAtPeriodEnd: true,
      });
      await recomputeEntitlement(USER_A);
      await setLastExpiryNotification(USER_A, 7);
      // Same cycle now -> marker preserved.
      await recomputeEntitlement(USER_A);
      [row] = await testDb
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, USER_A));
      expect(row?.endsAt?.getTime()).toBe(ends2.getTime());
      expect(row?.lastExpiryNotification).toBe(7);
    });

    it("downgrades pro→free and archives oldest excess domains when the period elapsed", async () => {
      await testDb
        .insert(userSubscriptions)
        .values({ userId: USER_A, tier: "pro", endsAt: past() });
      await seedTrackedDomains(USER_A, 8);
      await seedPolarRow(USER_A, "canceling", past());

      const result = await recomputeEntitlement(USER_A);

      expect(result.plan).toBe("free");
      expect(result.downgraded).toBe(true);
      expect(result.archivedCount).toBe(3);

      const tracked = await testDb
        .select()
        .from(userTrackedDomains)
        .where(eq(userTrackedDomains.userId, USER_A))
        .orderBy(asc(userTrackedDomains.createdAt));
      expect(tracked.slice(0, 3).every((d) => d.archivedAt !== null)).toBe(true);
      expect(tracked.slice(3).every((d) => d.archivedAt === null)).toBe(true);
    });

    it("never archives on a pro→pro recompute", async () => {
      await testDb.insert(userSubscriptions).values({ userId: USER_A, tier: "pro" });
      await seedTrackedDomains(USER_A, 8);
      await seedPolarRow(USER_A, "active");

      const result = await recomputeEntitlement(USER_A);

      expect(result.plan).toBe("pro");
      expect(result.upgraded).toBe(false);
      expect(result.downgraded).toBe(false);
      expect(result.archivedCount).toBe(0);
      const tracked = await testDb
        .select()
        .from(userTrackedDomains)
        .where(eq(userTrackedDomains.userId, USER_A));
      expect(tracked.every((d) => d.archivedAt === null)).toBe(true);
    });

    it("multi-provider invariant: an active provider blocks another's revoke", async () => {
      await testDb.insert(userSubscriptions).values({ userId: USER_A, tier: "pro" });
      await seedTrackedDomains(USER_A, 8);
      await seedPolarRow(USER_A, "expired", null, "polar");
      await seedPolarRow(USER_A, "active", null, "apple");

      const stillPro = await recomputeEntitlement(USER_A);
      expect(stillPro.plan).toBe("pro");
      expect(stillPro.downgraded).toBe(false);
      expect(stillPro.archivedCount).toBe(0);

      // Apple also expires -> now genuinely downgrades + archives.
      await upsertBillingSubscription(USER_A, {
        provider: "apple",
        externalId: USER_A,
        providerSubscriptionId: "apple:sub-a",
        productId: null,
        status: "expired",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      const downgraded = await recomputeEntitlement(USER_A);
      expect(downgraded.plan).toBe("free");
      expect(downgraded.downgraded).toBe(true);
      expect(downgraded.archivedCount).toBe(3);
    });

    it("endsAt is null while any provider is active, else the max canceling period", async () => {
      const ends1 = future();
      await seedPolarRow(USER_A, "canceling", ends1, "polar");
      await seedPolarRow(USER_A, "active", null, "apple");

      const withActive = await recomputeEntitlement(USER_A);
      expect(withActive.plan).toBe("pro");
      expect(withActive.endsAt).toBeNull();

      const ends2 = new Date(ends1.getTime() + 86_400_000);
      await upsertBillingSubscription(USER_A, {
        provider: "apple",
        externalId: USER_A,
        providerSubscriptionId: "apple:sub-a",
        productId: null,
        status: "canceling",
        currentPeriodEnd: ends2,
        cancelAtPeriodEnd: true,
      });
      const bothCanceling = await recomputeEntitlement(USER_A);
      expect(bothCanceling.plan).toBe("pro");
      expect(bothCanceling.endsAt?.getTime()).toBe(ends2.getTime());
    });
  });

  describe("getUserIdsPastDue", () => {
    it("returns cached-pro users whose billing rows no longer grant pro", async () => {
      await testDb.insert(users).values([
        { id: "u-c", email: "c@example.com", name: "C" },
        { id: "u-d", email: "d@example.com", name: "D" },
        { id: "u-e", email: "e@example.com", name: "E" },
      ]);
      await testDb.insert(userSubscriptions).values([
        { userId: USER_A, tier: "pro" }, // no billing rows -> past due
        { userId: USER_B, tier: "pro" }, // polar expired -> past due
        { userId: "u-c", tier: "pro" }, // canceling future -> excluded
        { userId: "u-d", tier: "pro" }, // polar expired + apple active -> excluded
        { userId: "u-e", tier: "free" }, // free -> excluded
      ]);
      await seedPolarRow(USER_B, "expired");
      await seedPolarRow("u-c", "canceling", future());
      await seedPolarRow("u-d", "expired", null, "polar");
      await seedPolarRow("u-d", "active", null, "apple");

      const pastDue = await getUserIdsPastDue();
      expect([...pastDue].sort()).toEqual([USER_A, USER_B].sort());
    });
  });
});
