import { beforeEach, describe, expect, it, vi } from "vitest";

type ActiveSubscriptionFixture = {
  amount: number;
  currency: string;
  recurringInterval: "month" | "year";
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

const {
  getUserSubscription,
  updateUserTier,
  setSubscriptionEndsAt,
  clearSubscriptionEndsAt,
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  getStateExternal,
} = vi.hoisted(() => ({
  getUserSubscription:
    vi.fn<
      (
        userId: string,
      ) => Promise<{ userId: string; plan: "free" | "pro"; planQuota: number; endsAt: Date | null }>
    >(),
  updateUserTier: vi.fn<(userId: string, tier: "free" | "pro") => Promise<void>>(),
  setSubscriptionEndsAt:
    vi.fn<
      (
        userId: string,
        endsAt: Date,
        options?: { resetNotificationTracking?: boolean },
      ) => Promise<void>
    >(),
  clearSubscriptionEndsAt: vi.fn<(userId: string) => Promise<void>>(),
  sendProUpgradeEmail: vi.fn<(userId: string) => Promise<void>>(),
  sendSubscriptionCancelingEmail: vi.fn<(userId: string, periodEnd: Date) => Promise<void>>(),
  getStateExternal: vi.fn<
    (input: { externalId: string }) => Promise<{
      activeSubscriptions: ActiveSubscriptionFixture[];
    }>
  >(),
}));

vi.mock("@domainstack/db/queries/user-subscription", () => ({
  getUserSubscription,
  updateUserTier,
  setSubscriptionEndsAt,
  clearSubscriptionEndsAt,
}));

vi.mock("./emails", () => ({
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
}));

vi.mock("./server", () => ({
  polarClient: { customers: { getStateExternal } },
}));

import { getCustomerSubscriptionState, syncSubscriptionFromPolar } from "./reconcile";

const PERIOD_END = new Date("2026-10-23T00:00:00Z");

function localSubscription(plan: "free" | "pro", endsAt: Date | null = null) {
  return { userId: "user-1", plan, planQuota: plan === "pro" ? 100 : 5, endsAt };
}

function activeSubscription(
  overrides: Partial<ActiveSubscriptionFixture> = {},
): ActiveSubscriptionFixture {
  return {
    amount: 200,
    currency: "usd",
    recurringInterval: "month",
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

describe("syncSubscriptionFromPolar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUserSubscription.mockResolvedValue(localSubscription("pro"));
    getStateExternal.mockResolvedValue({ activeSubscriptions: [activeSubscription()] });
  });

  it("grants pro and sends the welcome email when the active webhook has not landed", async () => {
    getUserSubscription.mockResolvedValue(localSubscription("free"));

    const result = await syncSubscriptionFromPolar("user-1");

    expect(updateUserTier).toHaveBeenCalledWith("user-1", "pro");
    expect(sendProUpgradeEmail).toHaveBeenCalledWith("user-1");
    expect(result).toMatchObject({ plan: "pro", changed: true });
  });

  it("returns billing details without writing when already in sync", async () => {
    const result = await syncSubscriptionFromPolar("user-1");

    expect(updateUserTier).not.toHaveBeenCalled();
    expect(clearSubscriptionEndsAt).not.toHaveBeenCalled();
    expect(setSubscriptionEndsAt).not.toHaveBeenCalled();
    expect(result).toEqual({
      plan: "pro",
      changed: false,
      billing: {
        amount: 200,
        currency: "usd",
        interval: "month",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
      },
    });
  });

  it("clears a stale end date when Polar shows a renewing subscription", async () => {
    getUserSubscription.mockResolvedValue(localSubscription("pro", PERIOD_END));

    const result = await syncSubscriptionFromPolar("user-1");

    expect(clearSubscriptionEndsAt).toHaveBeenCalledWith("user-1");
    expect(result.changed).toBe(true);
  });

  it("records a pending cancellation the canceled webhook has not delivered", async () => {
    getStateExternal.mockResolvedValue({
      activeSubscriptions: [activeSubscription({ cancelAtPeriodEnd: true })],
    });

    const result = await syncSubscriptionFromPolar("user-1");

    expect(setSubscriptionEndsAt).toHaveBeenCalledWith("user-1", PERIOD_END, {
      resetNotificationTracking: true,
    });
    expect(sendSubscriptionCancelingEmail).toHaveBeenCalledWith("user-1", PERIOD_END);
    expect(result).toMatchObject({ changed: true, billing: { cancelAtPeriodEnd: true } });
  });

  it("leaves a matching end date alone", async () => {
    getUserSubscription.mockResolvedValue(localSubscription("pro", new Date(PERIOD_END)));
    getStateExternal.mockResolvedValue({
      activeSubscriptions: [activeSubscription({ cancelAtPeriodEnd: true })],
    });

    const result = await syncSubscriptionFromPolar("user-1");

    expect(setSubscriptionEndsAt).not.toHaveBeenCalled();
    expect(sendSubscriptionCancelingEmail).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
  });

  it("prefers the renewing subscription when one is canceling and another is not", async () => {
    getUserSubscription.mockResolvedValue(localSubscription("pro", PERIOD_END));
    getStateExternal.mockResolvedValue({
      activeSubscriptions: [
        activeSubscription({ cancelAtPeriodEnd: true }),
        activeSubscription({ amount: 2000, recurringInterval: "year" }),
      ],
    });

    const result = await syncSubscriptionFromPolar("user-1");

    expect(clearSubscriptionEndsAt).toHaveBeenCalledWith("user-1");
    expect(result.billing).toMatchObject({ amount: 2000, interval: "year" });
  });

  it("never downgrades when Polar has no active subscription", async () => {
    getStateExternal.mockResolvedValue({ activeSubscriptions: [] });

    const result = await syncSubscriptionFromPolar("user-1");

    expect(updateUserTier).not.toHaveBeenCalled();
    expect(result).toEqual({ plan: "pro", changed: false, billing: null });
  });

  it("returns the local plan unchanged when Polar is unreachable", async () => {
    getUserSubscription.mockResolvedValue(localSubscription("free"));
    getStateExternal.mockRejectedValue(new Error("Polar down"));

    const result = await syncSubscriptionFromPolar("user-1");

    expect(updateUserTier).not.toHaveBeenCalled();
    expect(result).toEqual({ plan: "free", changed: false, billing: null });
  });

  it("still grants pro when the welcome email fails", async () => {
    getUserSubscription.mockResolvedValue(localSubscription("free"));
    sendProUpgradeEmail.mockRejectedValue(new Error("Resend down"));

    const result = await syncSubscriptionFromPolar("user-1");

    expect(updateUserTier).toHaveBeenCalledWith("user-1", "pro");
    expect(result.changed).toBe(true);
  });
});

describe("getCustomerSubscriptionState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reports a canceling-only customer as active but not renewing", async () => {
    getStateExternal.mockResolvedValue({
      activeSubscriptions: [activeSubscription({ cancelAtPeriodEnd: true })],
    });

    await expect(getCustomerSubscriptionState("user-1")).resolves.toEqual({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: false,
    });
  });

  it("reports unknown when Polar is unreachable", async () => {
    getStateExternal.mockRejectedValue(new Error("Polar down"));

    await expect(getCustomerSubscriptionState("user-1")).resolves.toEqual({ status: "unknown" });
  });
});
