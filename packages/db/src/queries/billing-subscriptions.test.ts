import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { BillingSubscriptionUpsert } from "@domainstack/types";

import { billingSubscriptions, users } from "../schema";
import { closePGliteDb, makePGliteDb } from "../testing";
import { upsertBillingSubscription } from "./index";

const USER = "bsub-user";
let testDb: Awaited<ReturnType<typeof makePGliteDb>>["db"];

const upsert = (over: Partial<BillingSubscriptionUpsert> = {}): BillingSubscriptionUpsert => ({
  provider: "polar",
  externalId: USER,
  providerSubscriptionId: "polar:sub-1",
  productId: null,
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  ...over,
});

describe("upsertBillingSubscription", () => {
  beforeAll(async () => {
    const bundle = await makePGliteDb();
    testDb = bundle.db;
  });

  beforeEach(async () => {
    await testDb.delete(billingSubscriptions);
    await testDb.delete(users);
    await testDb.insert(users).values({ id: USER, email: "b@example.com", name: "B" });
  });

  afterAll(async () => {
    await closePGliteDb();
  });

  it("updates the row in place on (provider, externalId) conflict", async () => {
    await upsertBillingSubscription(USER, upsert({ status: "active" }));
    await upsertBillingSubscription(
      USER,
      upsert({
        status: "canceling",
        providerSubscriptionId: "polar:sub-2",
        cancelAtPeriodEnd: true,
      }),
    );

    const rows = await testDb
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.userId, USER));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("canceling");
    expect(rows[0]?.providerSubscriptionId).toBe("polar:sub-2");
    expect(rows[0]?.cancelAtPeriodEnd).toBe(true);
  });

  it("keeps separate rows per provider for the same user", async () => {
    await upsertBillingSubscription(USER, upsert({ provider: "polar" }));
    await upsertBillingSubscription(
      USER,
      upsert({ provider: "apple", providerSubscriptionId: "apple:sub-1" }),
    );

    const rows = await testDb
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.userId, USER));
    expect(rows).toHaveLength(2);

    const [apple] = await testDb
      .select()
      .from(billingSubscriptions)
      .where(
        and(eq(billingSubscriptions.userId, USER), eq(billingSubscriptions.provider, "apple")),
      );
    expect(apple?.providerSubscriptionId).toBe("apple:sub-1");
  });
});
