import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Suspense } from "react";
import { toast } from "sonner";
import {
  CalendarInstructions,
  CalendarInstructionsSkeleton,
} from "@/components/calendar-instructions";
import { DomainOverrides } from "@/components/settings/notifications/domain-overrides";
import { NotificationMatrix } from "@/components/settings/notifications/notification-matrix";
import {
  SettingsCard,
  SettingsCardSeparator,
} from "@/components/settings/settings-card";
import { SettingsErrorBoundary } from "@/components/settings/settings-error-boundary";
import { NotificationsSkeleton } from "@/components/settings/settings-skeleton";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { useSession } from "@/lib/auth-client";
import type { NotificationCategory } from "@/lib/constants/notifications";
import { useTRPC } from "@/lib/trpc/client";
import type { UserNotificationPreferences } from "@/lib/types/notifications";

export function NotificationsPanel() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for cache manipulation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const globalPrefsQueryKey = trpc.user.getNotificationPreferences.queryKey();

  // Queries - both run in parallel
  const [domainsResult, globalPrefsResult] = useQueries({
    queries: [
      trpc.tracking.listDomains.queryOptions(),
      trpc.user.getNotificationPreferences.queryOptions(),
    ],
  });

  // Mutations with optimistic updates (must be called before early returns)
  const updateGlobalMutation = useMutation({
    ...trpc.user.updateGlobalNotificationPreferences.mutationOptions(),
    onMutate: async (newPrefs) => {
      await queryClient.cancelQueries({ queryKey: globalPrefsQueryKey });
      const previousPrefs =
        queryClient.getQueryData<UserNotificationPreferences>(
          globalPrefsQueryKey,
        );

      // Optimistically update
      queryClient.setQueryData<UserNotificationPreferences>(
        globalPrefsQueryKey,
        (old) => (old ? { ...old, ...newPrefs } : old),
      );

      return { previousPrefs };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData<UserNotificationPreferences>(
          globalPrefsQueryKey,
          context.previousPrefs,
        );
      }
      toast.error("Failed to update settings");
    },
    onSuccess: () => {
      toast.success("Global settings updated");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: globalPrefsQueryKey });
    },
  });

  const updateDomainMutation = useMutation({
    ...trpc.user.updateDomainNotificationOverrides.mutationOptions(),
    onMutate: async ({ trackedDomainId, overrides }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      // Snapshot all domain query variants for rollback
      const previousDomains = queryClient.getQueriesData<
        typeof domainsResult.data
      >({
        queryKey: domainsQueryKey,
      });

      // Optimistically update the domain's overrides in all query variants
      queryClient.setQueriesData<typeof domainsResult.data>(
        { queryKey: domainsQueryKey },
        (old) =>
          old
            ? old.map((d) =>
                d.id === trackedDomainId
                  ? {
                      ...d,
                      notificationOverrides: {
                        ...(d.notificationOverrides ?? {}),
                        ...overrides,
                      },
                    }
                  : d,
              )
            : old,
      );

      return { previousDomains };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDomains) {
        for (const [key, data] of context.previousDomains) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error("Failed to update settings");
    },
    onSuccess: () => {
      toast.success("Domain settings updated");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    },
  });

  const resetDomainMutation = useMutation({
    ...trpc.user.resetDomainNotificationOverrides.mutationOptions(),
    onMutate: async ({ trackedDomainId }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      // Snapshot all domain query variants for rollback
      const previousDomains = queryClient.getQueriesData<
        typeof domainsResult.data
      >({
        queryKey: domainsQueryKey,
      });

      // Optimistically reset the domain's overrides in all query variants
      queryClient.setQueriesData<typeof domainsResult.data>(
        { queryKey: domainsQueryKey },
        (old) =>
          old
            ? old.map((d) =>
                d.id === trackedDomainId
                  ? { ...d, notificationOverrides: {} }
                  : d,
              )
            : old,
      );

      return { previousDomains };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDomains) {
        for (const [key, data] of context.previousDomains) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error("Failed to reset settings");
    },
    onSuccess: () => {
      toast.success("Domain reset to global defaults");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    },
  });

  // Loading and error states (after all hooks)
  const isLoading = domainsResult.isLoading || globalPrefsResult.isLoading;
  const isError = domainsResult.isError || globalPrefsResult.isError;

  if (isLoading) {
    return <NotificationsSkeleton />;
  }

  if (isError || !domainsResult.data || !globalPrefsResult.data) {
    throw new Error("Failed to load notification settings");
  }

  // Data is now guaranteed to be defined
  const domains = domainsResult.data;
  const globalPrefsData = globalPrefsResult.data;

  const defaultGlobalPrefs: UserNotificationPreferences = {
    domainExpiry: { inApp: true, email: true },
    certificateExpiry: { inApp: true, email: true },
    registrationChanges: { inApp: true, email: true },
    providerChanges: { inApp: true, email: true },
    certificateChanges: { inApp: true, email: true },
  };

  // Merge defaults with saved preferences to ensure new fields are always present
  const globalPrefs: UserNotificationPreferences = {
    ...defaultGlobalPrefs,
    ...globalPrefsData,
  };

  const handleGlobalToggle = (
    category: NotificationCategory,
    type: "email" | "inApp",
    enabled: boolean,
  ) => {
    // Get current category preferences
    const currentPref = globalPrefs[category];

    // Update only the specific channel
    const updatedPref = {
      ...currentPref,
      [type === "email" ? "email" : "inApp"]: enabled,
    };

    updateGlobalMutation.mutate({ [category]: updatedPref });
  };

  const handleDomainToggle = (
    trackedDomainId: string,
    category: NotificationCategory,
    type: "email" | "inApp",
    value: boolean,
  ) => {
    // Find the current domain
    const domain = domains.find((d) => d.id === trackedDomainId);
    if (!domain) return;

    // Get current override for this category and global prefs
    const currentOverride = domain.notificationOverrides[category];
    const globalPref = globalPrefs[category];

    // Build the new override with both channels
    // Schema requires BOTH channels to be defined (no partial overrides allowed)
    const newOverride = {
      email:
        type === "email" ? value : (currentOverride?.email ?? globalPref.email),
      inApp:
        type === "inApp" ? value : (currentOverride?.inApp ?? globalPref.inApp),
    };

    // If both channels now match global, clear the override entirely (inherit)
    if (
      newOverride.email === globalPref.email &&
      newOverride.inApp === globalPref.inApp
    ) {
      updateDomainMutation.mutate({
        trackedDomainId,
        overrides: { [category]: undefined },
      });
    } else {
      updateDomainMutation.mutate({
        trackedDomainId,
        overrides: { [category]: newOverride },
      });
    }
  };

  const handleResetDomain = (trackedDomainId: string) => {
    resetDomainMutation.mutate({ trackedDomainId });
  };

  const verifiedDomains = domains
    .filter((d) => d.verified)
    .sort((a, b) => a.domainName.localeCompare(b.domainName));

  const isPending =
    updateGlobalMutation.isPending ||
    updateDomainMutation.isPending ||
    resetDomainMutation.isPending;

  return (
    <>
      <SettingsCard
        title="Global Preferences"
        description={
          <>
            Alerts will be sent to{" "}
            <span className="font-semibold">{session?.user?.email}</span>.{" "}
            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                render={
                  <span className="cursor-help text-muted-foreground underline decoration-dotted underline-offset-3" />
                }
              >
                (Why can&rsquo;t I change this?)
              </ResponsiveTooltipTrigger>
              <ResponsiveTooltipContent>
                <div className="space-y-2">
                  <p>
                    This is the email address that was verified with the linked
                    account provider you chose at sign up.
                  </p>
                  <p>
                    To change it, sign in with a different external account or{" "}
                    <a
                      href="/help#contact"
                      className="underline underline-offset-3"
                      target="_blank"
                      rel="noopener"
                    >
                      contact support
                    </a>
                    .
                  </p>
                </div>
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>
          </>
        }
      >
        <NotificationMatrix
          preferences={globalPrefs}
          onToggle={handleGlobalToggle}
          disabled={isPending}
        />
      </SettingsCard>

      <SettingsCardSeparator />

      <SettingsCard
        title="Domain Overrides"
        description="Customize notification settings for individual verified domains."
      >
        <DomainOverrides
          domains={verifiedDomains.map((d) => ({
            id: d.id,
            domainName: d.domainName,
            overrides: d.notificationOverrides,
          }))}
          globalPrefs={globalPrefs}
          onToggle={handleDomainToggle}
          onReset={handleResetDomain}
          disabled={isPending}
        />
      </SettingsCard>

      <SettingsCardSeparator />

      <SettingsCard
        title="Calendar Feed"
        description="Subscribe to domain expiration dates in your calendar app."
      >
        <SettingsErrorBoundary sectionName="Calendar Feed">
          <Suspense fallback={<CalendarInstructionsSkeleton />}>
            <CalendarInstructions />
          </Suspense>
        </SettingsErrorBoundary>
      </SettingsCard>
    </>
  );
}
