import type { WebhooksOptions } from "@polar-sh/better-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

// Mock the dependencies
vi.mock("@/lib/db/repos/user-subscription", () => ({
  updateUserTier: vi.fn(),
  setSubscriptionEndsAt: vi.fn(),
  clearSubscriptionEndsAt: vi.fn(),
}));

vi.mock("@/lib/polar/downgrade", () => ({
  handleDowngrade: vi.fn(),
}));

vi.mock("@/lib/polar/products", () => ({
  getTierForProductId: vi.fn(),
}));

import {
  clearSubscriptionEndsAt,
  setSubscriptionEndsAt,
  updateUserTier,
} from "@/lib/db/repos/user-subscription";
import { handleDowngrade } from "@/lib/polar/downgrade";
import { getTierForProductId } from "@/lib/polar/products";
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
} from "./handlers";

// Helper to create subscription data for webhook payloads
// Uses type assertions since we only need the fields our handlers access
function createSubscriptionData(overrides: {
  userId?: string | null;
  productId?: string;
  subscriptionId?: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
  canceledAt?: Date | null;
}) {
  const externalId: string | null =
    "userId" in overrides ? (overrides.userId ?? null) : "user-456";

  return {
    id: overrides.subscriptionId ?? "sub-123",
    customerId: "polar-cust-abc",
    customer: {
      id: "polar-cust-abc",
      externalId,
      email: "user@example.com",
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

// Helper factories for each payload type
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

describe("handleSubscriptionCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only logs (does not upgrade tier - payment not confirmed yet)", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionCreated(createCreatedPayload());

    // Should NOT call any tier-changing functions - just logs
    expect(updateUserTier).not.toHaveBeenCalled();
    expect(getTierForProductId).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upgrades user tier when product ID is recognized", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionActive(createActivePayload());

    expect(getTierForProductId).toHaveBeenCalledWith("prod-789");
    expect(updateUserTier).toHaveBeenCalledWith("user-456", "pro");
  });

  it("clears any pending subscription end date", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionActive(createActivePayload());

    expect(clearSubscriptionEndsAt).toHaveBeenCalledWith("user-456");
  });

  it("does not upgrade tier when product ID is unknown", async () => {
    vi.mocked(getTierForProductId).mockReturnValue(null);

    await handleSubscriptionActive(
      createActivePayload({ productId: "unknown-product" }),
    );

    expect(getTierForProductId).toHaveBeenCalledWith("unknown-product");
    expect(updateUserTier).not.toHaveBeenCalled();
    expect(clearSubscriptionEndsAt).not.toHaveBeenCalled();
  });

  it("does not upgrade tier when externalId (userId) is missing", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionActive(createActivePayload({ userId: null }));

    expect(updateUserTier).not.toHaveBeenCalled();
    expect(clearSubscriptionEndsAt).not.toHaveBeenCalled();
  });

  it("re-throws errors from updateUserTier for webhook retry", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");
    vi.mocked(updateUserTier).mockRejectedValue(new Error("Database error"));

    await expect(
      handleSubscriptionActive(createActivePayload()),
    ).rejects.toThrow("Database error");
  });
});

describe("handleSubscriptionCanceled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets subscription end date when currentPeriodEnd is provided", async () => {
    const periodEnd = new Date("2025-02-01T00:00:00Z");

    await handleSubscriptionCanceled(
      createCanceledPayload({
        cancelAtPeriodEnd: true,
        currentPeriodEnd: periodEnd,
        canceledAt: new Date("2025-01-15T12:00:00Z"),
      }),
    );

    expect(setSubscriptionEndsAt).toHaveBeenCalledWith("user-456", periodEnd);
    // Should NOT change tier yet
    expect(updateUserTier).not.toHaveBeenCalled();
    expect(handleDowngrade).not.toHaveBeenCalled();
  });

  it("does not set end date when currentPeriodEnd is null", async () => {
    await handleSubscriptionCanceled(
      createCanceledPayload({
        currentPeriodEnd: null,
      }),
    );

    expect(setSubscriptionEndsAt).not.toHaveBeenCalled();
  });

  it("does not set end date when userId is missing", async () => {
    await handleSubscriptionCanceled(
      createCanceledPayload({
        userId: null,
        currentPeriodEnd: new Date("2025-02-01T00:00:00Z"),
      }),
    );

    expect(setSubscriptionEndsAt).not.toHaveBeenCalled();
  });

  it("re-throws errors from setSubscriptionEndsAt for webhook retry", async () => {
    vi.mocked(setSubscriptionEndsAt).mockRejectedValue(
      new Error("Database error"),
    );

    await expect(
      handleSubscriptionCanceled(
        createCanceledPayload({
          currentPeriodEnd: new Date("2025-02-01T00:00:00Z"),
        }),
      ),
    ).rejects.toThrow("Database error");
  });
});

describe("handleSubscriptionRevoked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls handleDowngrade with user ID from customer.externalId", async () => {
    await handleSubscriptionRevoked(createRevokedPayload());

    expect(handleDowngrade).toHaveBeenCalledWith("user-456");
  });

  it("clears subscription end date after downgrade", async () => {
    await handleSubscriptionRevoked(createRevokedPayload());

    expect(clearSubscriptionEndsAt).toHaveBeenCalledWith("user-456");
  });

  it("does not downgrade when externalId (userId) is missing", async () => {
    await handleSubscriptionRevoked(createRevokedPayload({ userId: null }));

    expect(handleDowngrade).not.toHaveBeenCalled();
    expect(clearSubscriptionEndsAt).not.toHaveBeenCalled();
  });

  it("re-throws errors from handleDowngrade for webhook retry", async () => {
    vi.mocked(handleDowngrade).mockRejectedValue(new Error("Downgrade failed"));

    await expect(
      handleSubscriptionRevoked(createRevokedPayload()),
    ).rejects.toThrow("Downgrade failed");
  });
});
