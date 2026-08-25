import { vi } from "vitest";

export const mockSubscription = {
  plan: "pro" as "free" | "pro",
  planQuota: 100,
  endsAt: null as Date | null,
  activeCount: 4,
  archivedCount: 0,
  canAddMore: true,
};

export const subscriptionActionSpies = {
  handleCheckout: vi.fn<() => void>(),
  handleCustomerPortal: vi.fn<() => void>(),
};

export function resetSubscriptionActionSpies() {
  for (const spy of Object.values(subscriptionActionSpies)) {
    spy.mockClear();
  }
}

export function useSubscription() {
  return {
    subscription: mockSubscription,
    isPro: mockSubscription.plan === "pro",
    isSubscriptionLoading: false,
    isSubscriptionError: false,
    refetchSubscription: () => undefined,
    invalidateSubscription: () => undefined,
    handleCheckout: subscriptionActionSpies.handleCheckout,
    isCheckoutLoading: false,
    handleCustomerPortal: subscriptionActionSpies.handleCustomerPortal,
    isCustomerPortalLoading: false,
  };
}
