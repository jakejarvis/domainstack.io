import { useState } from "react";

import { LinkedAccountRow } from "@/components/settings/account/linked-account-row";
import { SettingsCard, SettingsCardSeparator } from "@/components/settings/settings-card";
import { LinkedAccountsSkeleton } from "@/components/settings/settings-skeleton";
import { useAuthCallback } from "@/hooks/use-auth-callback";
import { useLinkedAccounts } from "@/hooks/use-linked-accounts";
import type { OAuthProviderConfig } from "@/lib/oauth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@domainstack/ui/alert-dialog";
import { ItemGroup } from "@domainstack/ui/item";

import { DangerZone } from "./danger-zone";

export function AccountPanel() {
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  // Handle auth callback errors from URL params (account linking)
  useAuthCallback();

  const {
    linkedAccounts,
    linkedProviderIds,
    enabledProviders,
    isLoading,
    isError,
    canUnlink,
    linkProvider,
    unlinkProvider,
    isUnlinking,
  } = useLinkedAccounts();

  // Handle linking a provider with local loading state
  const handleLink = async (provider: OAuthProviderConfig) => {
    setLinkingProvider(provider.id);

    // Reset loading state if user returns to page (e.g., via back button)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setLinkingProvider(null);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    try {
      await linkProvider(provider);
      // Don't reset loading here - let it persist during navigation
      // It will be reset if user returns via back button
    } catch {
      // Error already handled in hook, just reset local state
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      setLinkingProvider(null);
    }
  };

  const handleUnlink = (providerId: string) => {
    unlinkProvider(providerId);
    setUnlinkingProvider(null);
  };

  // Loading and error states (after all hooks)
  if (isLoading) {
    return <LinkedAccountsSkeleton />;
  }

  if (isError || !linkedAccounts) {
    throw new Error("Failed to load linked accounts");
  }

  // Get the provider config being unlinked for the dialog
  const providerToUnlink = unlinkingProvider
    ? enabledProviders.find((p) => p.id === unlinkingProvider)
    : null;

  return (
    <>
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
              const isUnlinkingProvider = isUnlinking(provider.id);

              return (
                <LinkedAccountRow
                  key={provider.id}
                  provider={provider}
                  isLinked={isLinked}
                  canUnlink={canUnlink}
                  isLinking={isLinking}
                  isUnlinking={isUnlinkingProvider}
                  onLink={() => handleLink(provider)}
                  onUnlink={() => setUnlinkingProvider(provider.id)}
                />
              );
            })}
        </ItemGroup>
      </SettingsCard>

      <SettingsCardSeparator />

      <DangerZone />

      <AlertDialog
        open={unlinkingProvider !== null}
        onOpenChange={(open) => !open && setUnlinkingProvider(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink {providerToUnlink?.name ?? "account"}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to sign in with {providerToUnlink?.name ?? "this account"}.
              Make sure you have another way to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => unlinkingProvider && handleUnlink(unlinkingProvider)}
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
