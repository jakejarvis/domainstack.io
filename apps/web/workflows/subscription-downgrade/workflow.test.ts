/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSubscription: vi.fn<
    (userId: string) => Promise<{
      userId: string;
      plan: "free" | "pro";
      planQuota: number;
      endsAt: Date | null;
    }>
  >(),
  clearSubscriptionEndsAt: vi.fn<(userId: string) => Promise<void>>(),
  downgradeToFree: vi.fn<(userId: string) => Promise<{ wasPro: boolean; archivedCount: number }>>(),
  getCustomerSubscriptionState:
    vi.fn<
      (
        userId: string,
      ) => Promise<
        | { status: "ok"; hasActiveSubscription: boolean; hasNonCancelingActive: boolean }
        | { status: "unknown" }
      >
    >(),
  sendSubscriptionExpiredEmail: vi.fn<(userId: string, archivedCount: number) => Promise<void>>(),
}));

vi.mock("@domainstack/db/queries/user-subscription", () => ({
  getUserSubscription: mocks.getUserSubscription,
  clearSubscriptionEndsAt: mocks.clearSubscriptionEndsAt,
  downgradeToFree: mocks.downgradeToFree,
}));

vi.mock("@domainstack/polar/reconcile", () => ({
  getCustomerSubscriptionState: mocks.getCustomerSubscriptionState,
}));

vi.mock("@domainstack/polar/emails", () => ({
  sendSubscriptionExpiredEmail: mocks.sendSubscriptionExpiredEmail,
}));

import { subscriptionDowngradeWorkflow } from "./workflow";

const userId = "user-123";
const pastDue = new Date(Date.now() - 86_400_000);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUserSubscription.mockResolvedValue({
    userId,
    plan: "pro",
    planQuota: 100,
    endsAt: pastDue,
  });
  mocks.getCustomerSubscriptionState.mockResolvedValue({
    status: "ok",
    hasActiveSubscription: false,
    hasNonCancelingActive: false,
  });
  mocks.downgradeToFree.mockResolvedValue({ wasPro: true, archivedCount: 2 });
});

describe("subscriptionDowngradeWorkflow", () => {
  it("skips a user on the free plan without checking Polar", async () => {
    mocks.getUserSubscription.mockResolvedValue({
      userId,
      plan: "free",
      planQuota: 5,
      endsAt: pastDue,
    });

    await expect(subscriptionDowngradeWorkflow({ userId })).resolves.toEqual({
      skipped: true,
      reason: "not_pro",
    });
    expect(mocks.getCustomerSubscriptionState).not.toHaveBeenCalled();
  });

  it("skips a pro user without an end date", async () => {
    mocks.getUserSubscription.mockResolvedValue({
      userId,
      plan: "pro",
      planQuota: 100,
      endsAt: null,
    });

    await expect(subscriptionDowngradeWorkflow({ userId })).resolves.toEqual({
      skipped: true,
      reason: "no_end_date",
    });
  });

  it("skips a pro user whose end date is in the future", async () => {
    mocks.getUserSubscription.mockResolvedValue({
      userId,
      plan: "pro",
      planQuota: 100,
      endsAt: new Date(Date.now() + 86_400_000),
    });

    await expect(subscriptionDowngradeWorkflow({ userId })).resolves.toEqual({
      skipped: true,
      reason: "not_yet_due",
    });
  });

  it("skips when Polar state cannot be verified", async () => {
    mocks.getCustomerSubscriptionState.mockResolvedValue({ status: "unknown" });

    await expect(subscriptionDowngradeWorkflow({ userId })).resolves.toEqual({
      skipped: true,
      reason: "polar_unverified",
    });
    expect(mocks.downgradeToFree).not.toHaveBeenCalled();
  });

  it("clears endsAt for a non-canceling active subscription", async () => {
    mocks.getCustomerSubscriptionState.mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: true,
    });

    await expect(subscriptionDowngradeWorkflow({ userId })).resolves.toEqual({
      downgraded: false,
      reason: "still_active",
    });
    expect(mocks.clearSubscriptionEndsAt).toHaveBeenCalledOnce();
  });

  it("keeps endsAt when the only active subscription is canceling", async () => {
    mocks.getCustomerSubscriptionState.mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: false,
    });

    await expect(subscriptionDowngradeWorkflow({ userId })).resolves.toEqual({
      skipped: true,
      reason: "polar_pending",
    });
    expect(mocks.clearSubscriptionEndsAt).not.toHaveBeenCalled();
    expect(mocks.downgradeToFree).not.toHaveBeenCalled();
  });

  it("downgrades and emails after a real pro transition", async () => {
    await expect(subscriptionDowngradeWorkflow({ userId })).resolves.toEqual({
      downgraded: true,
      archivedCount: 2,
    });
    expect(mocks.sendSubscriptionExpiredEmail).toHaveBeenCalledWith(userId, 2);
  });

  it("does not email when another caller already downgraded the user", async () => {
    mocks.downgradeToFree.mockResolvedValue({ wasPro: false, archivedCount: 0 });

    await expect(subscriptionDowngradeWorkflow({ userId })).resolves.toEqual({
      downgraded: true,
      archivedCount: 0,
    });
    expect(mocks.sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
  });
});
