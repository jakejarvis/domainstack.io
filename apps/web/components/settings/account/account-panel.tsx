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
import { Button } from "@domainstack/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@domainstack/ui/collapsible";
import { ItemGroup } from "@domainstack/ui/item";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { LinkedAccountRow } from "@/components/settings/account/linked-account-row";
import {
  SettingsCard,
  SettingsCardSeparator,
} from "@/components/settings/settings-card";
import { LinkedAccountsSkeleton } from "@/components/settings/settings-skeleton";
import { useAuthCallback } from "@/hooks/use-auth-callback";
import { useLinkedAccounts } from "@/hooks/use-linked-accounts";
import type { OAuthProvider } from "@/lib/oauth";
import { DeleteAccountDialog } from "./delete-account-dialog";

export function AccountPanel() {
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
    null,
  );
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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

      <Collapsible className="rounded-md border border-destructive/20">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group flex w-full cursor-pointer items-center justify-between rounded-md bg-destructive/5 px-4 py-3 text-left transition-all hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 data-[panel-open]:rounded-b-none"
            >
              <div className="flex items-center gap-3">
                <IconAlertTriangle className="size-5 text-destructive" />
                <span className="font-medium text-destructive text-sm leading-none">
                  Danger Zone!
                </span>
              </div>
              <IconChevronDown className="size-4 text-destructive/60 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
            </button>
          }
        />
        <CollapsibleContent keepMounted>
          <div className="rounded-b-md bg-destructive/2 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">Delete account</p>
                <p className="text-muted-foreground text-xs">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <IconTrash />
                Delete
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                unlinkingProvider && handleUnlink(unlinkingProvider)
              }
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteAccountDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </>
  );
}
