import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecomputeResult } from "@domainstack/db/queries";
import type { BillingSubscriptionUpsert } from "@domainstack/types";

import type { WebhooksOptions } from "./better-auth/server";

// Extract payload types from WebhooksOptions (same as handlers.ts)
type SubscriptionCreatedPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionCreated"]>
>[0];
type SubscriptionActivePayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionActive"]>
>[0];
type SubscriptionCanceledPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionCanceled"]>
>[0];
type SubscriptionRevokedPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionRevoked"]>
>[0];
type SubscriptionUncanceledPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionUncanceled"]>
>[0];

// Hoist mock functions so they're available to vi.mock factory
const {
  upsertBillingSubscription,
  recomputeEntitlement,
  getCustomerSubscriptionState,
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
    getCustomerSubscriptionState:
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
}));

vi.mock("@domainstack/logger", () => ({
  logger: createMockLogger(),
  createLogger: vi.fn<(...args: unknown[]) => ReturnType<typeof createMockLogger>>(() =>
    createMockLogger(),
  ),
}));

vi.mock("./products", () => ({
  getTierForProductId: vi.fn<(productId: string) => "pro" | null>(),
}));

vi.mock("./reconcile", () => ({
  getCustomerSubscriptionState,
}));

vi.mock("./emails", () => ({
  sendProUpgradeEmail: vi.fn<(userId: string) => Promise<void>>(),
  sendSubscriptionCancelingEmail: vi.fn<(userId: string, periodEnd: Date) => Promise<void>>(),
  sendSubscriptionExpiredEmail: vi.fn<(userId: string, archivedCount: number) => Promise<void>>(),
}));

import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "./emails";
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
  handleSubscriptionUncanceled,
} from "./handlers";
import { getTierForProductId } from "./products";

const DOWNGRADED: RecomputeResult = {
  plan: "free",
  endsAt: null,
  changed: true,
  upgraded: false,
  downgraded: true,
  archivedCount: 0,
};
const PRO: RecomputeResult = {
  plan: "pro",
  endsAt: null,
  changed: true,
  upgraded: true,
  downgraded: false,
  archivedCount: 0,
};

// Helper to create subscription data for webhook payloads
function createSubscriptionData(overrides: {
  userId?: string | null;
  productId?: string;
  subscriptionId?: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  canceledAt?: Date | null;
}) {
  const externalId: string | null = "userId" in overrides ? (overrides.userId ?? null) : "user-456";

  return {
    id: overrides.subscriptionId ?? "sub-123",
    customerId: "polar-cust-abc",
    customer: {
      id: "polar-cust-abc",
      externalId,
      email: "user@example.test",
      name: "Test User",
    },
    product: {
      id: overrides.productId ?? "prod-789",
      name: "Pro Plan",
    },
    status: overrides.status ?? "active",
    cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: overrides.currentPeriodEnd ?? null,
    canceledAt: overrides.canceledAt ?? null,
  };
}

function createCreatedPayload(
  overrides: Parameters<typeof createSubscriptionData>[0] = {},
): SubscriptionCreatedPayload {
  return {
    type: "subscription.created",
    timestamp: new Date(),
    data: createSubscriptionData({ status: "incomplete", ...overrides }),
  } as SubscriptionCreatedPayload;
}

function createActivePayload(
  overrides: Parameters<typeof createSubscriptionData>[0] = {},
): SubscriptionActivePayload {
  return {
    type: "subscription.active",
    timestamp: new Date(),
    data: createSubscriptionData({ status: "active", ...overrides }),
  } as SubscriptionActivePayload;
}

function createCanceledPayload(
  overrides: Parameters<typeof createSubscriptionData>[0] = {},
): SubscriptionCanceledPayload {
  return {
    type: "subscription.canceled",
    timestamp: new Date(),
    data: createSubscriptionData(overrides),
  } as SubscriptionCanceledPayload;
}

function createRevokedPayload(
  overrides: Parameters<typeof createSubscriptionData>[0] = {},
): SubscriptionRevokedPayload {
  return {
    type: "subscription.revoked",
    timestamp: new Date(),
    data: createSubscriptionData(overrides),
  } as SubscriptionRevokedPayload;
}

function createUncanceledPayload(
  overrides: Parameters<typeof createSubscriptionData>[0] = {},
): SubscriptionUncanceledPayload {
  return {
    type: "subscription.uncanceled",
    timestamp: new Date(),
    data: createSubscriptionData({ status: "active", ...overrides }),
  } as SubscriptionUncanceledPayload;
}

describe("handleSubscriptionCreated", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("only logs (no billing write - payment not confirmed yet)", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionCreated(createCreatedPayload());

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
    expect(getTierForProductId).toHaveBeenCalledWith("prod-789");
  });
});

describe("handleSubscriptionActive", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO);
  });

  it("upserts an active Polar row and recomputes the entitlement", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionActive(createActivePayload());

    expect(getTierForProductId).toHaveBeenCalledWith("prod-789");
    expect(upsertBillingSubscription).toHaveBeenCalledWith("user-456", {
      provider: "polar",
      externalId: "user-456",
      providerSubscriptionId: "sub-123",
      productId: "prod-789",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    expect(recomputeEntitlement).toHaveBeenCalledWith("user-456");
  });

  it("still upgrades to pro when product ID is unknown (single-tier model)", async () => {
    vi.mocked(getTierForProductId).mockReturnValue(null);

    await handleSubscriptionActive(createActivePayload({ productId: "unknown-product" }));

    expect(upsertBillingSubscription).toHaveBeenCalledWith(
      "user-456",
      expect.objectContaining({ status: "active", productId: "unknown-product" }),
    );
    expect(recomputeEntitlement).toHaveBeenCalledWith("user-456");
  });

  it("does not upgrade tier when externalId (userId) is missing", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionActive(createActivePayload({ userId: null }));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
  });

  it("re-throws errors from upsertBillingSubscription for webhook retry", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");
    vi.mocked(upsertBillingSubscription).mockRejectedValue(new Error("Database error"));

    await expect(handleSubscriptionActive(createActivePayload())).rejects.toThrow("Database error");
  });

  it("sends pro upgrade email after the upgrade", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionActive(createActivePayload());

    expect(sendProUpgradeEmail).toHaveBeenCalledWith("user-456");
  });

  it("does not fail webhook if upgrade email fails", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");
    vi.mocked(sendProUpgradeEmail).mockRejectedValue(new Error("Email failed"));

    await expect(handleSubscriptionActive(createActivePayload())).resolves.not.toThrow();

    expect(upsertBillingSubscription).toHaveBeenCalled();
    expect(recomputeEntitlement).toHaveBeenCalled();
  });

  it("does not re-send the welcome email on webhook redelivery (no upgrade transition)", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");
    // Already pro: a redelivered subscription.active recomputes to the same
    // state (upgraded=false) — the row is still upserted but no email fires.
    vi.mocked(recomputeEntitlement).mockResolvedValue({ ...PRO, upgraded: false, changed: false });

    await handleSubscriptionActive(createActivePayload());

    expect(upsertBillingSubscription).toHaveBeenCalled();
    expect(recomputeEntitlement).toHaveBeenCalledWith("user-456");
    expect(sendProUpgradeEmail).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionCanceled", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO);
    // Default: Polar confirms no non-canceling active subscription, so the
    // canceled event is honored.
    vi.mocked(getCustomerSubscriptionState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: false,
    });
  });

  it("ignores a stale canceled event when a non-canceling active subscription exists", async () => {
    vi.mocked(getCustomerSubscriptionState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: true,
    });

    await handleSubscriptionCanceled(
      createCanceledPayload({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date("2025-02-01T00:00:00Z"),
      }),
    );

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
  });

  it("upserts a canceling row when currentPeriodEnd is provided", async () => {
    const periodEnd = new Date("2025-02-01T00:00:00Z");

    await handleSubscriptionCanceled(
      createCanceledPayload({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: periodEnd,
        canceledAt: new Date("2025-01-15T12:00:00Z"),
      }),
    );

    expect(upsertBillingSubscription).toHaveBeenCalledWith("user-456", {
      provider: "polar",
      externalId: "user-456",
      providerSubscriptionId: "sub-123",
      productId: "prod-789",
      status: "canceling",
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
    });
    expect(recomputeEntitlement).toHaveBeenCalledWith("user-456");
  });

  it("does not write when currentPeriodEnd is null", async () => {
    await handleSubscriptionCanceled(createCanceledPayload({ currentPeriodEnd: null }));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
  });

  it("does not write when userId is missing", async () => {
    await handleSubscriptionCanceled(
      createCanceledPayload({
        userId: null,
        currentPeriodEnd: new Date("2025-02-01T00:00:00Z"),
      }),
    );

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
  });

  it("re-throws errors from upsertBillingSubscription for webhook retry", async () => {
    vi.mocked(upsertBillingSubscription).mockRejectedValue(new Error("Database error"));

    await expect(
      handleSubscriptionCanceled(
        createCanceledPayload({ currentPeriodEnd: new Date("2025-02-01T00:00:00Z") }),
      ),
    ).rejects.toThrow("Database error");
  });

  it("sends immediate cancellation confirmation email", async () => {
    const periodEnd = new Date("2025-02-01T00:00:00Z");

    await handleSubscriptionCanceled(createCanceledPayload({ currentPeriodEnd: periodEnd }));

    expect(sendSubscriptionCancelingEmail).toHaveBeenCalledWith("user-456", periodEnd);
  });

  it("does not fail webhook if cancellation email fails", async () => {
    vi.mocked(sendSubscriptionCancelingEmail).mockRejectedValue(new Error("Email failed"));

    await expect(
      handleSubscriptionCanceled(
        createCanceledPayload({ currentPeriodEnd: new Date("2025-02-01T00:00:00Z") }),
      ),
    ).resolves.not.toThrow();

    expect(upsertBillingSubscription).toHaveBeenCalled();
  });

  it("does not re-send the canceling email on redelivery (no cycle change)", async () => {
    // Redelivered canceled event: same endsAt, recompute reports changed=false.
    vi.mocked(recomputeEntitlement).mockResolvedValue({ ...PRO, changed: false });

    await handleSubscriptionCanceled(
      createCanceledPayload({ currentPeriodEnd: new Date("2025-02-01T00:00:00Z") }),
    );

    expect(upsertBillingSubscription).toHaveBeenCalled();
    expect(recomputeEntitlement).toHaveBeenCalledWith("user-456");
    expect(sendSubscriptionCancelingEmail).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionRevoked", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: recompute reports a genuine pro→free downgrade.
    vi.mocked(recomputeEntitlement).mockResolvedValue(DOWNGRADED);
    // Default: Polar confirms the customer has no active subscription.
    vi.mocked(getCustomerSubscriptionState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: false,
      hasNonCancelingActive: false,
    });
  });

  it("ignores a stale revoked event when the customer still has an active subscription", async () => {
    vi.mocked(getCustomerSubscriptionState).mockResolvedValue({
      status: "ok",
      hasActiveSubscription: true,
      hasNonCancelingActive: true,
    });

    await handleSubscriptionRevoked(createRevokedPayload());

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
  });

  it("skips downgrade when Polar state cannot be verified", async () => {
    vi.mocked(getCustomerSubscriptionState).mockResolvedValue({ status: "unknown" });

    await handleSubscriptionRevoked(createRevokedPayload());

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
  });

  it("upserts an expired row and recomputes for the user from customer.externalId", async () => {
    await handleSubscriptionRevoked(createRevokedPayload());

    expect(upsertBillingSubscription).toHaveBeenCalledWith(
      "user-456",
      expect.objectContaining({ provider: "polar", externalId: "user-456", status: "expired" }),
    );
    expect(recomputeEntitlement).toHaveBeenCalledWith("user-456");
  });

  it("sends subscription expired email with archived count when downgraded", async () => {
    vi.mocked(recomputeEntitlement).mockResolvedValue({ ...DOWNGRADED, archivedCount: 3 });

    await handleSubscriptionRevoked(createRevokedPayload());

    expect(sendSubscriptionExpiredEmail).toHaveBeenCalledWith("user-456", 3);
  });

  it("does not send expired email when recompute did not downgrade (multi-provider)", async () => {
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO);

    await handleSubscriptionRevoked(createRevokedPayload());

    expect(upsertBillingSubscription).toHaveBeenCalled();
    expect(sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
  });

  it("does not fail webhook if email sending fails", async () => {
    vi.mocked(sendSubscriptionExpiredEmail).mockRejectedValue(new Error("Email failed"));

    await expect(handleSubscriptionRevoked(createRevokedPayload())).resolves.not.toThrow();

    expect(upsertBillingSubscription).toHaveBeenCalled();
    expect(recomputeEntitlement).toHaveBeenCalled();
  });

  it("does not downgrade when externalId (userId) is missing", async () => {
    await handleSubscriptionRevoked(createRevokedPayload({ userId: null }));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
    expect(recomputeEntitlement).not.toHaveBeenCalled();
    expect(sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
  });

  it("re-throws errors from recomputeEntitlement for webhook retry", async () => {
    vi.mocked(recomputeEntitlement).mockRejectedValue(new Error("Downgrade failed"));

    await expect(handleSubscriptionRevoked(createRevokedPayload())).rejects.toThrow(
      "Downgrade failed",
    );
  });
});

describe("handleSubscriptionUncanceled", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(recomputeEntitlement).mockResolvedValue(PRO);
  });

  it("upserts an active row and recomputes when the user uncancels", async () => {
    await handleSubscriptionUncanceled(createUncanceledPayload());

    expect(upsertBillingSubscription).toHaveBeenCalledWith(
      "user-456",
      expect.objectContaining({ provider: "polar", status: "active", cancelAtPeriodEnd: false }),
    );
    expect(recomputeEntitlement).toHaveBeenCalledWith("user-456");
  });

  it("does not write when externalId (userId) is missing", async () => {
    await handleSubscriptionUncanceled(createUncanceledPayload({ userId: null }));

    expect(upsertBillingSubscription).not.toHaveBeenCalled();
  });

  it("re-throws errors from upsertBillingSubscription for webhook retry", async () => {
    vi.mocked(upsertBillingSubscription).mockRejectedValue(new Error("Database error"));

    await expect(handleSubscriptionUncanceled(createUncanceledPayload())).rejects.toThrow(
      "Database error",
    );
  });
});
