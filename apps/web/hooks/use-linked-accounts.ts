"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { analytics } from "@/lib/analytics/client";
import { getEnabledProviders, type OAuthProvider } from "@/lib/oauth";
import { useTRPC } from "@/lib/trpc/client";
import { linkSocial, unlinkAccount } from "@domainstack/auth/client";
import { toast } from "@domainstack/ui/toast";

export interface UseLinkedAccountsReturn {
  /** List of linked accounts */
  linkedAccounts: { id: string; providerId: string }[] | undefined;
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

  // Unlink mutation with optimistic updates.
  // Better Auth 1.7 selects the local account row by `accountId` (`accounts.id`).
  const unlinkMutation = useMutation({
    mutationFn: async ({ accountId }: { accountId: string; providerId: string }) => {
      const result = await unlinkAccount({ accountId });
      if (result.error) {
        throw new Error(result.error.message || "Failed to unlink account");
      }
      return result;
    },
    onMutate: async ({ accountId }) => {
      await queryClient.cancelQueries({ queryKey: linkedAccountsQueryKey });

      const previousAccounts =
        queryClient.getQueryData<typeof linkedAccounts>(linkedAccountsQueryKey);

      queryClient.setQueryData(linkedAccountsQueryKey, (old: typeof linkedAccounts | undefined) =>
        old?.filter((a) => a.id !== accountId),
      );

      return { previousAccounts };
    },
    onError: (err, { providerId }, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(linkedAccountsQueryKey, context.previousAccounts);
      }
      analytics.trackException(err instanceof Error ? err : new Error(String(err)), {
        provider: providerId,
        action: "unlink_account",
      });
      toast.add({ title: "Failed to unlink account. Please try again.", type: "error" });
    },
    onSuccess: (_data, { providerId }) => {
      const provider = enabledProviders.find((p) => p.id === providerId);
      toast.add({
        title: `${provider?.name ?? "Account"} unlinked successfully`,
        type: "success",
      });
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
      analytics.trackException(err instanceof Error ? err : new Error(String(err)), {
        provider: provider.id,
        action: "link_account",
      });
      toast.add({ title: `Failed to link ${provider.name}. Please try again.`, type: "error" });
      throw err; // Re-throw so caller can handle loading state
    }
  };

  // Derived state
  const linkedProviderIds = new Set(linkedAccounts?.map((a) => a.providerId) ?? []);
  const canUnlink = linkedProviderIds.size > 1;

  return {
    linkedAccounts,
    linkedProviderIds,
    enabledProviders,
    isLoading,
    isError,
    canUnlink,
    linkProvider,
    unlinkProvider: (providerId: string) => {
      const account = linkedAccounts?.find((a) => a.providerId === providerId);
      if (!account) return;
      unlinkMutation.mutate({ accountId: account.id, providerId });
    },
    isUnlinking: (providerId: string) =>
      unlinkMutation.isPending && unlinkMutation.variables?.providerId === providerId,
    isUnlinkPending: unlinkMutation.isPending,
  };
}
