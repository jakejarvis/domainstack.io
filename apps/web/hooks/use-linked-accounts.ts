"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import posthogClient from "posthog-js";
import { toast } from "sonner";

import { authErrorDescription } from "@/lib/auth-client-error";
import { getEnabledProviders, type OAuthProviderConfig } from "@/lib/oauth";
import { useTRPC } from "@/lib/trpc/client";
import type { AppRouter } from "@domainstack/api";
import { linkSocial, unlinkAccount } from "@domainstack/auth/client";

export interface UseLinkedAccountsReturn {
  /** List of linked accounts */
  linkedAccounts: { id: string; providerId: string }[] | undefined;
  /** Set of linked provider IDs for quick lookup */
  linkedProviderIds: Set<string>;
  /** All enabled OAuth providers */
  enabledProviders: OAuthProviderConfig[];
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether the query failed */
  isError: boolean;
  /** The query error, if any */
  error: TRPCClientErrorLike<AppRouter> | null;
  /** Whether user can unlink (must have at least 2 linked accounts) */
  canUnlink: boolean;
  /** Link a provider (navigates to OAuth flow) */
  linkProvider: (provider: OAuthProviderConfig) => Promise<void>;
  /** Unlink a provider */
  unlinkProvider: (providerId: string) => void;
  /** Whether a specific provider is currently being unlinked */
  isUnlinking: (providerId: string) => boolean;
  /** Whether the unlink mutation is pending */
  isUnlinkPending: boolean;
}

async function linkProvider(provider: OAuthProviderConfig) {
  const fail = (err: unknown, description: string) => {
    posthogClient.captureException(err, {
      provider: provider.id,
      action: "link_account",
    });
    toast.error(`Failed to link ${provider.name}.`, { description });
  };

  let result: Awaited<ReturnType<typeof linkSocial>>;
  try {
    result = await linkSocial({
      provider: provider.id,
      callbackURL: "/settings/account",
      // Link failures (email mismatch, already linked, cancelled) come back here
      // with ?error=...; AccountPanel's useAuthCallback turns it into a toast.
      errorCallbackURL: "/settings/account",
    });
  } catch (err) {
    fail(err, "Please try again.");
    throw err; // Re-throw so caller can handle loading state
  }

  // Better Auth resolves `{ error }` (e.g. a 401 once the session expired) instead of throwing
  if (result.error) {
    const err = new Error(result.error.message ?? `link failed (${result.error.status})`);
    fail(err, authErrorDescription(result.error));
    throw err; // Re-throw so caller can handle loading state
  }
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
    error,
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
      posthogClient.captureException(err, {
        provider: providerId,
        action: "unlink_account",
      });
      toast.error("Failed to unlink account. Please try again.");
    },
    onSuccess: (_data, { providerId }) => {
      const provider = enabledProviders.find((p) => p.id === providerId);
      toast.success(`${provider?.name ?? "Account"} unlinked successfully`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries(trpc.user.getLinkedAccounts.queryFilter());
    },
  });

  // Derived state
  const linkedProviderIds = new Set(linkedAccounts?.map((a) => a.providerId) ?? []);
  const canUnlink = linkedProviderIds.size > 1;

  return {
    linkedAccounts,
    linkedProviderIds,
    enabledProviders,
    isLoading,
    isError,
    error,
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
