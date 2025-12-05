import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the dependencies
vi.mock("@/lib/db/repos/user-limits", () => ({
  updateUserTier: vi.fn(),
}));

vi.mock("@/lib/polar/downgrade", () => ({
  handleDowngrade: vi.fn(),
}));

vi.mock("@/lib/polar/products", () => ({
  getTierForProductId: vi.fn(),
}));

import { updateUserTier } from "@/lib/db/repos/user-limits";
import { handleDowngrade } from "@/lib/polar/downgrade";
import { getTierForProductId } from "@/lib/polar/products";
import {
  handleSubscriptionCreated,
  handleSubscriptionRevoked,
} from "./handlers";

// Helper to create a valid webhook payload
function createWebhookPayload(overrides: {
  userId?: string | null;
  productId?: string;
  subscriptionId?: string;
}) {
  // Determine externalId: use override if key present, otherwise default
  const externalId: string | null =
    "userId" in overrides ? (overrides.userId ?? null) : "user-456";

  return {
    data: {
      id: overrides.subscriptionId ?? "sub-123",
      customerId: "polar-cust-abc", // Polar's internal customer ID
      customer: {
        id: "polar-cust-abc",
        externalId, // Our user ID
        email: "user@example.com",
        name: "Test User",
      },
      product: {
        id: overrides.productId ?? "prod-789",
        name: "Pro Plan",
      },
      status: "active",
    },
  };
}

describe("handleSubscriptionCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upgrades user tier when product ID is recognized", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionCreated(createWebhookPayload({}));

    expect(getTierForProductId).toHaveBeenCalledWith("prod-789");
    expect(updateUserTier).toHaveBeenCalledWith("user-456", "pro");
  });

  it("does not upgrade tier when product ID is unknown", async () => {
    vi.mocked(getTierForProductId).mockReturnValue(null);

    await handleSubscriptionCreated(
      createWebhookPayload({ productId: "unknown-product" }),
    );

    expect(getTierForProductId).toHaveBeenCalledWith("unknown-product");
    expect(updateUserTier).not.toHaveBeenCalled();
  });

  it("does not upgrade tier when externalId (userId) is missing", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");

    await handleSubscriptionCreated(createWebhookPayload({ userId: null }));

    expect(updateUserTier).not.toHaveBeenCalled();
  });

  it("re-throws errors from updateUserTier for webhook retry", async () => {
    vi.mocked(getTierForProductId).mockReturnValue("pro");
    vi.mocked(updateUserTier).mockRejectedValue(new Error("Database error"));

    await expect(
      handleSubscriptionCreated(createWebhookPayload({})),
    ).rejects.toThrow("Database error");
  });
});

describe("handleSubscriptionRevoked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls handleDowngrade with user ID from customer.externalId", async () => {
    await handleSubscriptionRevoked(createWebhookPayload({}));

    expect(handleDowngrade).toHaveBeenCalledWith("user-456");
  });

  it("does not downgrade when externalId (userId) is missing", async () => {
    await handleSubscriptionRevoked(createWebhookPayload({ userId: null }));

    expect(handleDowngrade).not.toHaveBeenCalled();
  });

  it("re-throws errors from handleDowngrade for webhook retry", async () => {
    vi.mocked(handleDowngrade).mockRejectedValue(new Error("Downgrade failed"));

    await expect(
      handleSubscriptionRevoked(createWebhookPayload({})),
    ).rejects.toThrow("Downgrade failed");
  });
});
