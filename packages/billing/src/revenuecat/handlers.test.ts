import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecomputeResult } from "@domainstack/db/queries";
import type { BillingSubscriptionUpsert } from "@domainstack/types";

import type { RevenueCatEvent, RevenueCatEventType } from "./types";

const {
  upsertBillingSubscription,
  recomputeEntitlement,
  getUserById,
  getRevenueCatCustomerState,
  createMockLogger,
} = vi.hoisted(() => {
  type MockLogger = Record<
    "log" | "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "child",
    ReturnType<typeof vi.fn>
  >;

  const buildMockLogger = (): MockLogger => ({
    log: vi.fn<(...args: unknown[]) => void>(),
    trace: vi.fn<(...args: unknown[]) => void>(),
    debug: vi.fn<(...args: unknown[]) => void>(),
    info: vi.fn<(...args: unknown[]) => void>(),
    warn: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
    fatal: vi.fn<(...args: unknown[]) => void>(),
    child: vi.fn<(...args: unknown[]) => MockLogger>(() => buildMockLogger()),
  });

  return {
    upsertBillingSubscription:
      vi.fn<(userId: string, input: BillingSubscriptionUpsert) => Promise<void>>(),
    recomputeEntitlement: vi.fn<(userId: string) => Promise<RecomputeResult>>(),
    getUserById:
      vi.fn<(id: string) => Promise<{ id: string; email: string; name: string } | null>>(),
    getRevenueCatCustomerState:
      vi.fn<
        (
          userId: string,
        ) => Promise<
          | { status: "ok"; hasActiveSubscription: boolean; hasNonCancelingActive: boolean }
          | { status: "unknown" }
        >
      >(),
    createMockLogger: buildMockLogger,
  };
});

vi.mock("@domainstack/db/queries", () => ({
  upsertBillingSubscription,
  recomputeEntitlement,
  getUserById,
}));

vi.mock("@domainstack/logger", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn<(...args: unknown[]) => ReturnType<typeof createMockLogger>>(() =>
    createMockLogger(),
  ),
}));

vi.mock("../emails", () => ({
  sendProUpgradeEmail: vi.fn<(userId: string) => Promise<void>>(),
  sendSubscriptionCancelingEmail: vi.fn<(userId: string, periodEnd: Date) => Promise<void>>(),
  sendSubscriptionExpiredEmail: vi.fn<(userId: string, archivedCount: number) => Promise<void>>(),
}));

vi.mock("./reconcile", () => ({
  getRevenueCatCustomerState,
}));

import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "../emails";
import { handleRevenueCatEvent } from "./handlers";

const PRO: RecomputeResult = {
  plan: "pro",
  endsAt: null,
  changed: true,
  upgraded: true,
  downgraded: false,
  archivedCount: 0,
};
const PRO_NO_CHANGE: RecomputeResult = { ...PRO, upgraded: false, changed: false };
const DOWNGRADED: RecomputeResult = {
  plan: "free",
  endsAt: null,
  changed: true,
  upgraded: false,
  downgraded: true,
  archivedCount: 0,
};

const FUTURE_MS = Date.parse("2030-01-01T00:00:00Z");

function event(
  type: RevenueCatEventType,
  overrides: Partial<RevenueCatEvent> = {},
): RevenueCatEvent {
  return {
    type,
    id: "evt-1",
    app_user_id: "user-1",
    product_id: "io.domainstack.pro.monthly",
    original_transaction_id: "otxn-1",
    expiration_at_ms: FUTURE_MS,
    environment: "PRODUCTION",
    store: "APP_STORE",
    ...overrides,
  };
}

describe("handleRevenueCatEvent — purchases", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO);
  });

  it("INITIAL_PURCHASE upserts an active row, recomputes, sends upgrade email", async () => {
    await handleRevenueCatEvent(event("INITIAL_PURCHASE"));

    expect(upsertBillingSubscription).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ provider: "revenuecat", status: "active" }),
    );
    expect(recomputeEntitlement).toHaveBeenCalledWith("user-1");
    expect(sendProUpgradeEmail).toHaveBeenCalledWith("user-1");
  });

  it("does not re-send upgrade email on redelivery (no transition)", async () => {
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO_NO_CHANGE);

    await handleRevenueCatEvent(event("RENEWAL"));

    expect(upsertBillingSubscription).toHaveBeenCalled();
    expect(sendProUpgradeEmail).not.toHaveBeenCalled();
  });

  it("ignores an event with no app_user_id", async () => {
    await handleRevenueCatEvent(event("INITIAL_PURCHASE", { app_user_id: null }));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
  });

  it("ignores BILLING_ISSUE (grace period — never downgrade)", async () => {
    await handleRevenueCatEvent(event("BILLING_ISSUE"));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
  });

  it("ignores TEST events", async () => {
    await handleRevenueCatEvent(event("TEST"));
    expect(upsertBillingSubscription).not.toHaveBeenCalled();
  });

  it("re-throws DB errors so RevenueCat retries", async () => {
    vi.mocked(upsertBillingSubscription).mockRejectedValue(new Error("DB down"));

    await expect(handleRevenueCatEvent(event("INITIAL_PURCHASE"))).rejects.toThrow("DB down");
  });

  it("does not fail when the upgrade email throws", async () => {
    vi.mocked(sendProUpgradeEmail).mockRejectedValue(new Error("email"));

    await expect(handleRevenueCatEvent(event("INITIAL_PURCHASE"))).resolves.not.toThrow();
    expect(upsertBillingSubscription).toHaveBeenCalled();
  });
});

describe("handleRevenueCatEvent — cancellation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO);
    vi.mocked(getRevenueCatCustomerState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: false,
    });
  });

  it("CANCELLATION upserts canceling, recomputes, emails when changed", async () => {
    await handleRevenueCatEvent(event("CANCELLATION"));

    expect(upsertBillingSubscription).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ status: "canceling", cancelAtPeriodEnd: true }),
    );
    expect(sendSubscriptionCancelingEmail).toHaveBeenCalledWith("user-1", new Date(FUTURE_MS));
  });

  it("ignores a stale CANCELLATION when a non-canceling active subscription exists", async () => {
    vi.mocked(getRevenueCatCustomerState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: true,
    });

    await handleRevenueCatEvent(event("CANCELLATION"));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
  });

  it("skips a CANCELLATION without a future period end", async () => {
    await handleRevenueCatEvent(event("CANCELLATION", { expiration_at_ms: null }));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
  });

  it("does not re-send canceling email on redelivery", async () => {
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO_NO_CHANGE);

    await handleRevenueCatEvent(event("CANCELLATION"));

    expect(upsertBillingSubscription).toHaveBeenCalled();
    expect(sendSubscriptionCancelingEmail).not.toHaveBeenCalled();
  });
});

describe("handleRevenueCatEvent — expiration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(recomputeEntitlement).mockResolvedValue(DOWNGRADED);
    vi.mocked(getRevenueCatCustomerState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: false,
      hasNonCancelingActive: false,
    });
  });

  it("EXPIRATION upserts expired, recomputes, sends expired email when downgraded", async () => {
    vi.mocked(recomputeEntitlement).mockResolvedValue({ ...DOWNGRADED, archivedCount: 2 });

    await handleRevenueCatEvent(event("EXPIRATION"));

    expect(upsertBillingSubscription).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ status: "expired" }),
    );
    expect(sendSubscriptionExpiredEmail).toHaveBeenCalledWith("user-1", 2);
  });

  it("ignores a stale EXPIRATION when the customer still has an active subscription", async () => {
    vi.mocked(getRevenueCatCustomerState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: true,
    });

    await handleRevenueCatEvent(event("EXPIRATION"));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
  });

  it("skips downgrade when RevenueCat state cannot be verified", async () => {
    vi.mocked(getRevenueCatCustomerState).mockResolvedValue({ status: "unknown" });

    await handleRevenueCatEvent(event("EXPIRATION"));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
  });

  it("does not send expired email when recompute did not downgrade (multi-provider)", async () => {
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO);

    await handleRevenueCatEvent(event("EXPIRATION"));

    expect(upsertBillingSubscription).toHaveBeenCalled();
    expect(sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
  });
});

describe("handleRevenueCatEvent — transfer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUserById).mockResolvedValue({
      id: "u",
      email: "u@example.test",
      name: "U",
    });
  });

  it("expires the from-user and grants the to-user from reconciled state", async () => {
    vi.mocked(recomputeEntitlement)
      .mockResolvedValueOnce(DOWNGRADED) // transferred_from
      .mockResolvedValueOnce(PRO); // transferred_to
    vi.mocked(getRevenueCatCustomerState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: true,
    });

    await handleRevenueCatEvent(
      event("TRANSFER", {
        app_user_id: null,
        transferred_from: ["old-user"],
        transferred_to: ["new-user"],
      }),
    );

    expect(upsertBillingSubscription).toHaveBeenCalledWith(
      "old-user",
      expect.objectContaining({ status: "expired" }),
    );
    expect(sendSubscriptionExpiredEmail).toHaveBeenCalledWith("old-user", 0);
    expect(upsertBillingSubscription).toHaveBeenCalledWith(
      "new-user",
      expect.objectContaining({ status: "active" }),
    );
    expect(sendProUpgradeEmail).toHaveBeenCalledWith("new-user");
  });

  it("does not grant the to-user when reconcile shows no active subscription", async () => {
    vi.mocked(recomputeEntitlement).mockResolvedValue(DOWNGRADED);
    vi.mocked(getRevenueCatCustomerState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: false,
      hasNonCancelingActive: false,
    });

    await handleRevenueCatEvent(
      event("TRANSFER", {
        app_user_id: null,
        transferred_from: [],
        transferred_to: ["new-user"],
      }),
    );

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
  });
});
