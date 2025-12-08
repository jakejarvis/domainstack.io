"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { LinkedAccountRow } from "@/components/dashboard/linked-account-row";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { linkSocial, unlinkAccount } from "@/lib/auth-client";
import {
  OAUTH_PROVIDERS,
  type OAuthProviderConfig,
} from "@/lib/constants/oauth-providers";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

interface LinkedAccountsSectionProps {
  /** Whether to show the card wrapper styling (false for modal usage) */
  showCard?: boolean;
}

export function LinkedAccountsSection({
  showCard = true,
}: LinkedAccountsSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
    null,
  );
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  // Query for linked accounts
  const linkedAccountsQuery = useQuery(
    trpc.user.getLinkedAccounts.queryOptions(),
  );
  const linkedAccountsQueryKey = trpc.user.getLinkedAccounts.queryKey();

  // Set of linked provider IDs for quick lookup
  const linkedProviderIds = new Set(
    linkedAccountsQuery.data?.map((a) => a.providerId) ?? [],
  );

  // Check if user can unlink (must have at least 2 linked accounts)
  const canUnlink = linkedProviderIds.size > 1;

  // Handle linking a provider
  const handleLink = async (provider: OAuthProviderConfig) => {
    setLinkingProvider(provider.id);

    try {
      await linkSocial({
        provider: provider.id,
        callbackURL: "/dashboard/settings",
      });
      // The page will redirect to the OAuth provider, so no need to handle success here
    } catch (err) {
      logger.error(`Failed to link ${provider.name}`, err, {
        provider: provider.id,
      });
      toast.error(`Failed to link ${provider.name}. Please try again.`);
      setLinkingProvider(null);
    }
  };

  // Mutation for unlinking
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
      const previousAccounts = queryClient.getQueryData(linkedAccountsQueryKey);

      // Optimistically update to remove the account
      queryClient.setQueryData(
        linkedAccountsQueryKey,
        (old: typeof linkedAccountsQuery.data) =>
          old?.filter((a) => a.providerId !== providerId),
      );

      return { previousAccounts };
    },
    onError: (err, _providerId, context) => {
      // Rollback on error
      if (context?.previousAccounts) {
        queryClient.setQueryData(
          linkedAccountsQueryKey,
          context.previousAccounts,
        );
      }
      logger.error("Failed to unlink account", err);
      toast.error("Failed to unlink account. Please try again.");
    },
    onSuccess: (_data, providerId) => {
      const provider = OAUTH_PROVIDERS.find((p) => p.id === providerId);
      toast.success(`${provider?.name ?? "Account"} unlinked successfully`);
    },
    onSettled: () => {
      setUnlinkingProvider(null);
      void queryClient.invalidateQueries({ queryKey: linkedAccountsQueryKey });
    },
  });

  const handleUnlink = (providerId: string) => {
    unlinkMutation.mutate(providerId);
  };

  // Get the provider config being unlinked for the dialog
  const providerToUnlink = unlinkingProvider
    ? OAUTH_PROVIDERS.find((p) => p.id === unlinkingProvider)
    : null;

  if (linkedAccountsQuery.isLoading) {
    return (
      <div className={cn(!showCard && "py-1")}>
        <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
          <CardTitle>Linked Accounts</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </div>
    );
  }

  if (linkedAccountsQuery.isError) {
    return (
      <div className={cn(!showCard && "py-1")}>
        <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
          <CardTitle>Linked Accounts</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load linked accounts
          </CardDescription>
        </CardHeader>
      </div>
    );
  }

  return (
    <>
      <div className={cn(!showCard && "py-1")}>
        <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
          <CardTitle>Linked Accounts</CardTitle>
          <CardDescription>
            Manage the accounts you use to sign in
          </CardDescription>
        </CardHeader>
        <CardContent className={showCard ? "space-y-3" : "space-y-3 px-0"}>
          {OAUTH_PROVIDERS.map((provider) => {
            const isLinked = linkedProviderIds.has(provider.id);
            const isLinking = linkingProvider === provider.id;

            return (
              <LinkedAccountRow
                key={provider.id}
                provider={provider}
                isLinked={isLinked}
                canUnlink={canUnlink}
                isLinking={isLinking}
                unlinkMutation={unlinkMutation}
                onLink={() => handleLink(provider)}
                onUnlink={() => setUnlinkingProvider(provider.id)}
              />
            );
          })}
        </CardContent>
      </div>

      <ConfirmActionDialog
        open={unlinkingProvider !== null}
        onOpenChange={(open) => !open && setUnlinkingProvider(null)}
        title={`Unlink ${providerToUnlink?.name ?? "account"}?`}
        description={`You will no longer be able to sign in with ${providerToUnlink?.name ?? "this account"}. Make sure you have another way to access your account.`}
        confirmLabel="Unlink"
        onConfirm={() => unlinkingProvider && handleUnlink(unlinkingProvider)}
        variant="destructive"
      />
    </>
  );
}
