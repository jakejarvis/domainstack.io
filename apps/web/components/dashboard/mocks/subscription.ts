export const mockSubscription = {
  plan: "pro" as const,
  planQuota: 100,
  endsAt: null as Date | null,
  activeCount: 4,
  archivedCount: 0,
  canAddMore: true,
};

export function useSubscription() {
  return {
    subscription: mockSubscription,
    isPro: mockSubscription.plan === "pro",
    isSubscriptionLoading: false,
    isSubscriptionError: false,
    refetchSubscription: () => undefined,
    invalidateSubscription: () => undefined,
    handleCheckout: () => undefined,
    isCheckoutLoading: false,
    handleCustomerPortal: () => undefined,
    isCustomerPortalLoading: false,
  };
}
