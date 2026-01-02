import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LinkedAccountRow } from "@/components/settings/linked-account-row";
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
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthCallback } from "@/hooks/use-auth-callback";
import { analytics } from "@/lib/analytics/client";
import { linkSocial, unlinkAccount } from "@/lib/auth-client";
import {
  OAUTH_PROVIDERS,
  type OAuthProviderConfig,
} from "@/lib/constants/oauth-providers";
import { useTRPC } from "@/lib/trpc/client";

interface LinkedAccountsSectionProps {
  className?: string;
}

export function LinkedAccountsSection({
  className,
}: LinkedAccountsSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
    null,
  );
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  // Handle auth callback errors from URL params (account linking)
  useAuthCallback();

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
      const previousAccounts = queryClient.getQueryData<
        typeof linkedAccountsQuery.data
      >(linkedAccountsQueryKey);

      // Optimistically update to remove the account
      queryClient.setQueryData(
        linkedAccountsQueryKey,
        (old: typeof linkedAccountsQuery.data) =>
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
    return <LinkedAccountsSkeleton className={className} />;
  }

  if (linkedAccountsQuery.isError) {
    return (
      <div className={className}>
        <CardHeader className="px-0 pt-0 pb-2">
          <CardTitle>Providers</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load providers
          </CardDescription>
        </CardHeader>
      </div>
    );
  }

  return (
    <>
      <div className={className}>
        <CardHeader className="px-0 pt-0 pb-2">
          <CardTitle>Login Providers</CardTitle>
          <CardDescription>
            Protect your account with additional third-party services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-0 pt-1">
          {[...OAUTH_PROVIDERS]
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
        </CardContent>
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
