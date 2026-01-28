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
type SubscriptionUncanceledPayload = Parameters<
  NonNullable<WebhooksOptions["onSubscriptionUncanceled"]>
>[0];

// Hoist mock functions so they're available to vi.mock factory
const { updateUserTier, setSubscriptionEndsAt, clearSubscriptionEndsAt } =
  vi.hoisted(() => ({
    updateUserTier: vi.fn(),
    setSubscriptionEndsAt: vi.fn(),
    clearSubscriptionEndsAt: vi.fn(),
  }));

// Mock the dependencies
vi.mock("@/lib/db/repos", () => ({
  userSubscriptionRepo: {
    updateUserTier,
    setSubscriptionEndsAt,
    clearSubscriptionEndsAt,
  },
}));

vi.mock("@/lib/polar/downgrade", () => ({
  handleDowngrade: vi.fn(),
}));

vi.mock("@/lib/polar/products", () => ({
  getTierForProductId: vi.fn(),
}));

vi.mock("@/lib/polar/emails", () => ({
  sendProUpgradeEmail: vi.fn(),
  sendSubscriptionCancelingEmail: vi.fn(),
  sendSubscriptionExpiredEmail: vi.fn(),
}));

import { handleDowngrade } from "@/lib/polar/downgrade";
import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "@/lib/polar/emails";
import { getTierForProductId } from "@/lib/polar/products";
import {
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
  handleSubscriptionUncanceled,
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

  it("only logs (does not upgrade tier - payment not confirmed yet)", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionCreated(createCreatedPayload());

    // Should NOT upgrade tier - payment not confirmed yet
    // getTierForProductId is called for analytics tracking, but updateUserTier should not be called
    expect(updateUserTier).not.toHaveBeenCalled();
    expect(getTierForProductId).toHaveBeenCalledWith("prod-789");
  });
});

describe("handleSubscriptionActive", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it("sends pro upgrade email after tier upgrade", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionActive(createActivePayload());

    expect(sendProUpgradeEmail).toHaveBeenCalledWith("user-456");
  });

  it("does not fail webhook if upgrade email fails", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");
    vi.mocked(sendProUpgradeEmail).mockRejectedValue(new Error("Email failed"));

    // Should not throw - email errors are logged but swallowed
    await expect(
      handleSubscriptionActive(createActivePayload()),
    ).resolves.not.toThrow();

    expect(updateUserTier).toHaveBeenCalled();
    expect(clearSubscriptionEndsAt).toHaveBeenCalled();
  });
});

describe("handleSubscriptionCanceled", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it("sends immediate cancellation confirmation email", async () => {
    const periodEnd = new Date("2025-02-01T00:00:00Z");

    await handleSubscriptionCanceled(
      createCanceledPayload({
        currentPeriodEnd: periodEnd,
      }),
    );

    expect(sendSubscriptionCancelingEmail).toHaveBeenCalledWith(
      "user-456",
      periodEnd,
    );
  });

  it("does not fail webhook if cancellation email fails", async () => {
    vi.mocked(sendSubscriptionCancelingEmail).mockRejectedValue(
      new Error("Email failed"),
    );

    // Should not throw - email errors are logged but swallowed
    await expect(
      handleSubscriptionCanceled(
        createCanceledPayload({
          currentPeriodEnd: new Date("2025-02-01T00:00:00Z"),
        }),
      ),
    ).resolves.not.toThrow();

    expect(setSubscriptionEndsAt).toHaveBeenCalled();
  });
});

describe("handleSubscriptionRevoked", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: handleDowngrade returns 0 archived domains
    vi.mocked(handleDowngrade).mockResolvedValue(0);
  });

  it("calls handleDowngrade with user ID from customer.externalId", async () => {
    await handleSubscriptionRevoked(createRevokedPayload());

    expect(handleDowngrade).toHaveBeenCalledWith("user-456");
  });

  it("clears subscription end date after downgrade", async () => {
    await handleSubscriptionRevoked(createRevokedPayload());

    expect(clearSubscriptionEndsAt).toHaveBeenCalledWith("user-456");
  });

  it("sends subscription expired email with archived count", async () => {
    vi.mocked(handleDowngrade).mockResolvedValue(3);

    await handleSubscriptionRevoked(createRevokedPayload());

    expect(sendSubscriptionExpiredEmail).toHaveBeenCalledWith("user-456", 3);
  });

  it("does not fail webhook if email sending fails", async () => {
    vi.mocked(sendSubscriptionExpiredEmail).mockRejectedValue(
      new Error("Email failed"),
    );

    // Should not throw - email errors are logged but swallowed
    await expect(
      handleSubscriptionRevoked(createRevokedPayload()),
    ).resolves.not.toThrow();

    expect(handleDowngrade).toHaveBeenCalled();
    expect(clearSubscriptionEndsAt).toHaveBeenCalled();
  });

  it("does not downgrade when externalId (userId) is missing", async () => {
    await handleSubscriptionRevoked(createRevokedPayload({ userId: null }));

    expect(handleDowngrade).not.toHaveBeenCalled();
    expect(clearSubscriptionEndsAt).not.toHaveBeenCalled();
    expect(sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
  });

  it("re-throws errors from handleDowngrade for webhook retry", async () => {
    vi.mocked(handleDowngrade).mockRejectedValue(new Error("Downgrade failed"));

    await expect(
      handleSubscriptionRevoked(createRevokedPayload()),
    ).rejects.toThrow("Downgrade failed");
  });
});

describe("handleSubscriptionUncanceled", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("clears subscription end date when user uncancels", async () => {
    await handleSubscriptionUncanceled(createUncanceledPayload());

    expect(clearSubscriptionEndsAt).toHaveBeenCalledWith("user-456");
  });

  it("does not clear end date when externalId (userId) is missing", async () => {
    await handleSubscriptionUncanceled(
      createUncanceledPayload({ userId: null }),
    );

    expect(clearSubscriptionEndsAt).not.toHaveBeenCalled();
  });

  it("re-throws errors from clearSubscriptionEndsAt for webhook retry", async () => {
    vi.mocked(clearSubscriptionEndsAt).mockRejectedValue(
      new Error("Database error"),
    );

    await expect(
      handleSubscriptionUncanceled(createUncanceledPayload()),
    ).rejects.toThrow("Database error");
  });
});
