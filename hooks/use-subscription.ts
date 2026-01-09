"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { checkoutEmbed, customer } from "@/lib/auth-client";
import { PRO_TIER_INFO } from "@/lib/polar/products";
import { useTRPC } from "@/lib/trpc/client";
import type { Subscription } from "@/lib/types";

type UseSubscriptionOptions = {
  /** Whether to enable the query (defaults to true) */
  enabled?: boolean;
};

type UseSubscriptionResult = {
  /** Subscription data (undefined while loading) */
  subscription: Subscription | undefined;
  /** True if user has Pro subscription */
  isPro: boolean;
  /** True if actively loading */
  isSubscriptionLoading: boolean;
  /** True if error occurred */
  isSubscriptionError: boolean;
  /** Refetch subscription data */
  refetchSubscription: () => void;
  /** Invalidate subscription query cache */
  invalidateSubscription: () => void;
  /** Handle checkout */
  handleCheckout: () => void;
  /** True if checkout is loading */
  isCheckoutLoading: boolean;
  /** Handle customer portal */
  handleCustomerPortal: () => void;
  /** True if customer portal is loading */
  isCustomerPortalLoading: boolean;
};

/**
 * Hook to check user's subscription tier and limits.
 * Use this to guard Pro features and display upgrade prompts.
 *
 * @param options - Configuration options
 * @param options.enabled - Whether to enable the query (defaults to true)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isPro, subscription, isLoading } = useSubscription();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   if (!isPro) {
 *     return <UpgradePrompt />;
 *   }
 *
 *   return <ProFeature />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Check subscription status
 * function FeatureList() {
 *   const { isPro, subscription } = useSubscription();
 *
 *   return (
 *     <div>
 *       <span>Tier: {subscription?.tier}</span>
 *       <span>Domains: {subscription?.activeCount}/{subscription?.maxDomains}</span>
 *       {isPro && <ProBadge />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Conditionally enable query based on auth state
 * function PublicComponent() {
 *   const { data: session } = useSession();
 *   const { subscription } = useSubscription({ enabled: !!session?.user });
 *
 *   if (!session?.user) {
 *     return <LoginPrompt />;
 *   }
 *
 *   return <div>Tier: {subscription?.tier}</div>;
 * }
 * ```
 */
export function useSubscription(
  options: UseSubscriptionOptions = {},
): UseSubscriptionResult {
  const { enabled = true } = options;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isCheckoutLoading, setCheckoutLoading] = useState(false);
  const [isCustomerPortalLoading, setCustomerPortalLoading] = useState(false);

  const query = useQuery({
    ...trpc.user.getSubscription.queryOptions(),
    enabled,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.user.getSubscription.queryKey(),
    });
  }, [queryClient, trpc]);

  const handleCheckout = async () => {
    if (isCheckoutLoading) return;
    setCheckoutLoading(true);
    analytics.track("upgrade_clicked");

    try {
      await checkoutEmbed({
        products: [
          PRO_TIER_INFO.monthly.productId,
          PRO_TIER_INFO.yearly.productId,
        ],
      });
    } catch (err) {
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        { action: "upgrade_checkout" },
      );
      toast.error("Failed to open checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCustomerPortal = async () => {
    if (isCustomerPortalLoading) return;
    setCustomerPortalLoading(true);
    analytics.track("customer_portal_opened");

    try {
      await customer.portal();
    } catch (err) {
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        { action: "open_customer_portal" },
      );
      toast.error("Failed to open customer portal. Please try again.");
    } finally {
      setCustomerPortalLoading(false);
    }
  };

  return {
    subscription: query.data,
    isPro: query.data?.plan === "pro",
    isSubscriptionLoading: query.isLoading,
    isSubscriptionError: query.isError,
    refetchSubscription: query.refetch,
    invalidateSubscription: invalidate,
    handleCheckout,
    isCheckoutLoading,
    handleCustomerPortal,
    isCustomerPortalLoading,
  };
}
