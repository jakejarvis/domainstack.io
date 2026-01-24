import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DangerZoneCollapsible } from "@/components/settings/account/danger-zone-collapsible";
import { LinkedAccountRow } from "@/components/settings/account/linked-account-row";
import {
  SettingsCard,
  SettingsCardSeparator,
} from "@/components/settings/settings-card";
import { LinkedAccountsSkeleton } from "@/components/settings/settings-skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ItemGroup } from "@/components/ui/item";
import { useAuthCallback } from "@/hooks/use-auth-callback";
import { analytics } from "@/lib/analytics/client";
import { linkSocial, unlinkAccount } from "@/lib/auth-client";
import { getEnabledProviders, type OAuthProvider } from "@/lib/oauth";
import { useTRPC } from "@/lib/trpc/client";

export function AccountPanel() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
    null,
  );
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const enabledProviders = getEnabledProviders();

  // Handle auth callback errors from URL params (account linking)
  useAuthCallback();

  // Query for linked accounts
  const {
    data: linkedAccounts,
    isLoading,
    isError,
  } = useQuery(trpc.user.getLinkedAccounts.queryOptions());
  const linkedAccountsQueryKey = trpc.user.getLinkedAccounts.queryKey();

  // Handle linking a provider
  const handleLink = async (provider: OAuthProvider) => {
    setLinkingProvider(provider.id);

    // Reset loading state if user returns to page (e.g., via back button)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setLinkingProvider(null);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    try {
      await linkSocial({
        provider: provider.id,
        // On error, better-auth appends ?error=... to the callback URL
        callbackURL: "/settings",
      });
      // Don't reset loading here - let it persist during navigation
      // It will be reset if user returns via back button
    } catch (err) {
      // Only reset on actual error
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      setLinkingProvider(null);
      analytics.trackException(
        err instanceof Error ? err : new Error(String(err)),
        { provider: provider.id, action: "link_account" },
      );
      toast.error(`Failed to link ${provider.name}. Please try again.`);
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
      setUnlinkingProvider(null);
      void queryClient.invalidateQueries({ queryKey: linkedAccountsQueryKey });
    },
  });

  const handleUnlink = (providerId: string) => {
    unlinkMutation.mutate(providerId);
  };

  // Loading and error states (after all hooks)
  if (isLoading) {
    return <LinkedAccountsSkeleton />;
  }

  if (isError || !linkedAccounts) {
    throw new Error("Failed to load linked accounts");
  }

  // Set of linked provider IDs for quick lookup
  const linkedProviderIds = new Set(linkedAccounts.map((a) => a.providerId));

  // Check if user can unlink (must have at least 2 linked accounts)
  const canUnlink = linkedProviderIds.size > 1;

  // Get the provider config being unlinked for the dialog
  const providerToUnlink = unlinkingProvider
    ? enabledProviders.find((p) => p.id === unlinkingProvider)
    : null;

  return (
    <>
      <div className="max-w-full overflow-x-hidden">
        <SettingsCard
          title="Login Providers"
          description="Protect your account with additional third-party services."
        >
          <ItemGroup className="gap-2.5">
            {[...enabledProviders]
              .sort((a, b) => {
                const aLinked = linkedProviderIds.has(a.id);
                const bLinked = linkedProviderIds.has(b.id);
                // Linked providers first, then alphabetically by name
                if (aLinked !== bLinked) return bLinked ? 1 : -1;
                return a.name.localeCompare(b.name);
              })
              .map((provider) => {
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
          </ItemGroup>
        </SettingsCard>

        <SettingsCardSeparator />

        <DangerZoneCollapsible />
      </div>

      <AlertDialog
        open={unlinkingProvider !== null}
        onOpenChange={(open) => !open && setUnlinkingProvider(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unlink {providerToUnlink?.name ?? "account"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to sign in with{" "}
              {providerToUnlink?.name ?? "this account"}. Make sure you have
              another way to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                unlinkingProvider && handleUnlink(unlinkingProvider)
              }
              className="cursor-pointer"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
