"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { UserTier } from "@/lib/schemas";
import { useTRPC } from "@/lib/trpc/client";

export type SubscriptionData = {
  /** User's current tier */
  tier: UserTier;
  /** Maximum domains user can track */
  maxDomains: number;
  /** Number of active domains */
  activeCount: number;
  /** Number of archived domains */
  archivedCount: number;
  /** Can user add more domains */
  canAddMore: boolean;
  /** When canceled subscription ends (null if no pending cancellation) */
  subscriptionEndsAt: Date | null;
  /** Pro tier max domains for upgrade prompts */
  proMaxDomains: number;
};

export type UseSubscriptionOptions = {
  /** Whether to enable the query (defaults to true) */
  enabled?: boolean;
};

export type UseSubscriptionResult = {
  /** Subscription data (undefined while loading) */
  subscription: SubscriptionData | undefined;
  /** True if user has Pro subscription */
  isPro: boolean;
  /** True if actively loading */
  isLoading: boolean;
  /** True if error occurred */
  isError: boolean;
  /** Refetch subscription data */
  refetch: () => void;
  /** Invalidate subscription query cache */
  invalidate: () => void;
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

  const query = useQuery({
    ...trpc.user.getSubscription.queryOptions(),
    enabled,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.user.getSubscription.queryKey(),
    });
  }, [queryClient, trpc]);

  const subscription: SubscriptionData | undefined = query.data
    ? {
        tier: query.data.tier,
        maxDomains: query.data.maxDomains,
        activeCount: query.data.activeCount,
        archivedCount: query.data.archivedCount,
        canAddMore: query.data.canAddMore,
        subscriptionEndsAt: query.data.subscriptionEndsAt,
        proMaxDomains: query.data.proMaxDomains,
      }
    : undefined;

  return {
    subscription,
    isPro: subscription?.tier === "pro",
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    invalidate,
  };
}
