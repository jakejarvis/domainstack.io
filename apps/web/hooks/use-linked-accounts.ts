"use client";

import { analytics } from "@domainstack/analytics/client";
import { linkSocial, unlinkAccount } from "@domainstack/auth/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEnabledProviders, type OAuthProvider } from "@/lib/oauth";
import { useTRPC } from "@/lib/trpc/client";

export interface UseLinkedAccountsReturn {
  /** List of linked accounts */
  linkedAccounts: { providerId: string }[] | undefined;
  /** Set of linked provider IDs for quick lookup */
  linkedProviderIds: Set<string>;
  /** All enabled OAuth providers */
  enabledProviders: OAuthProvider[];
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether the query failed */
  isError: boolean;
  /** Whether user can unlink (must have at least 2 linked accounts) */
  canUnlink: boolean;
  /** Link a provider (navigates to OAuth flow) */
  linkProvider: (provider: OAuthProvider) => Promise<void>;
  /** Unlink a provider */
  unlinkProvider: (providerId: string) => void;
  /** Whether a specific provider is currently being unlinked */
  isUnlinking: (providerId: string) => boolean;
  /** Whether the unlink mutation is pending */
  isUnlinkPending: boolean;
}

/**
 * Hook for managing linked OAuth accounts.
 * Encapsulates query and mutation logic for the account settings panel.
 */
export function useLinkedAccounts(): UseLinkedAccountsReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const enabledProviders = getEnabledProviders();

  // Query key for cache manipulation
  const linkedAccountsQueryKey = trpc.user.getLinkedAccounts.queryKey();

  // Query for linked accounts
  const {
    data: linkedAccounts,
    isLoading,
    isError,
  } = useQuery(trpc.user.getLinkedAccounts.queryOptions());

  // Unlink mutation with optimistic updates
  const unlinkMutation = useMutation({
    mutationFn: async (providerId: string) => {
      const result = await unlinkAccount({ providerId });
      if (result.error) {
        throw new Error(result.error.message || "Failed to unlink account");
      }
      return result;
    },
    onMutate: async (providerId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: linkedAccountsQueryKey });

      // Snapshot the previous value
      const previousAccounts = queryClient.getQueryData<typeof linkedAccounts>(
        linkedAccountsQueryKey,
      );

      // Optimistically update to remove the account
      queryClient.setQueryData(
        linkedAccountsQueryKey,
        (old: typeof linkedAccounts | undefined) =>
          old?.filter((a) => a.providerId !== providerId),
      );

      return { previousAccounts };
    },
    onError: (err, providerId, context) => {
      // Rollback on error
      if (context?.previousAccounts) {
        queryClient.setQueryData(
          linkedAccountsQueryKey,
          context.previousAccounts,
        );
      }
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        { provider: providerId, action: "unlink_account" },
      );
      toast.error("Failed to unlink account. Please try again.");
    },
    onSuccess: (_data, providerId) => {
      const provider = enabledProviders.find((p) => p.id === providerId);
      toast.success(`${provider?.name ?? "Account"} unlinked successfully`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: linkedAccountsQueryKey });
    },
  });

  // Link provider (navigates to OAuth flow)
  const linkProvider = async (provider: OAuthProvider) => {
    try {
      await linkSocial({
        provider: provider.id,
        // On error, better-auth appends ?error=... to the callback URL
        callbackURL: "/settings",
      });
    } catch (err) {
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        { provider: provider.id, action: "link_account" },
      );
      toast.error(`Failed to link ${provider.name}. Please try again.`);
      throw err; // Re-throw so caller can handle loading state
    }
  };

  // Derived state
  const linkedProviderIds = new Set(
    linkedAccounts?.map((a) => a.providerId) ?? [],
  );
  const canUnlink = linkedProviderIds.size > 1;

  return {
    linkedAccounts,
    linkedProviderIds,
    enabledProviders,
    isLoading,
    isError,
    canUnlink,
    linkProvider,
    unlinkProvider: (providerId: string) => unlinkMutation.mutate(providerId),
    isUnlinking: (providerId: string) =>
      unlinkMutation.isPending && unlinkMutation.variables === providerId,
    isUnlinkPending: unlinkMutation.isPending,
  };
}
