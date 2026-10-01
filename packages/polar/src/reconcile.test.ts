import { beforeEach, describe, expect, it, vi } from "vitest";

// reconcile.ts calls createLogger at module load, so the logger instance must exist
// (and be returned by createLogger) before the import below.
const { getState, logger } = await vi.hoisted(async () => {
  const { createMockLogger } = await import("@domainstack/logger/testing");
  return {
    getState: vi.fn<(userId: string) => Promise<unknown>>(),
    logger: createMockLogger(),
  };
});

vi.mock("@domainstack/logger", () => ({
  logger,
  createLogger: () => logger,
}));

vi.mock("@polar-sh/sdk/2026-10/services/customers", () => ({
  getStateExternalCustomers: () => getState,
}));

vi.mock("./server", () => ({
  polarClient: {},
}));

import { getCustomerSubscriptionState } from "./reconcile";

function subscription(overrides: { cancelAtPeriodEnd: boolean; currentPeriodEnd: string }) {
  return {
    cancel_at_period_end: overrides.cancelAtPeriodEnd,
    current_period_end: overrides.currentPeriodEnd,
  };
}

describe("getCustomerSubscriptionState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("treats a 404 (customer not found) as no active subscription", async () => {
    getState.mockRejectedValue(Object.assign(new Error("Not found"), { statusCode: 404 }));

    await expect(getCustomerSubscriptionState("user-1")).resolves.toEqual({
      status: "ok",
      hasActiveSubscription: false,
      hasNonCancelingActive: false,
      cancelingPeriodEnd: null,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns unknown and logs for other API errors", async () => {
    getState.mockRejectedValue(Object.assign(new Error("Server error"), { statusCode: 500 }));

    await expect(getCustomerSubscriptionState("user-1")).resolves.toEqual({ status: "unknown" });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("returns the latest period end when every active subscription is canceling", async () => {
    getState.mockResolvedValue({
      active_subscriptions: [
        subscription({ cancelAtPeriodEnd: true, currentPeriodEnd: "2026-11-01T00:00:00Z" }),
        subscription({ cancelAtPeriodEnd: true, currentPeriodEnd: "2026-12-01T00:00:00Z" }),
      ],
    });

    await expect(getCustomerSubscriptionState("user-1")).resolves.toEqual({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: false,
      cancelingPeriodEnd: new Date("2026-12-01T00:00:00Z"),
    });
  });

  it("has no canceling period end when a renewing subscription exists", async () => {
    getState.mockResolvedValue({
      active_subscriptions: [
        subscription({ cancelAtPeriodEnd: false, currentPeriodEnd: "2026-11-01T00:00:00Z" }),
        subscription({ cancelAtPeriodEnd: true, currentPeriodEnd: "2026-12-01T00:00:00Z" }),
      ],
    });

    await expect(getCustomerSubscriptionState("user-1")).resolves.toEqual({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: true,
      cancelingPeriodEnd: null,
    });
  });
});
