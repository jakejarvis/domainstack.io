import {
  BellSimpleIcon,
  CalendarIcon,
  GlobeIcon,
  InfoIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react/ssr";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarInstructions } from "@/components/calendar-instructions";
import { DomainNotificationRow } from "@/components/settings/notifications/domain-notification-row";
import { GlobalNotificationRow } from "@/components/settings/notifications/global-notification-row";
import { NotificationsSkeleton } from "@/components/settings/settings-skeleton";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/lib/auth-client";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import { useTRPC } from "@/lib/trpc/client";
import type { UserNotificationPreferences } from "@/lib/types/notifications";

export function NotificationsPanel() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for cache manipulation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const globalPrefsQueryKey = trpc.user.getNotificationPreferences.queryKey();

  // Queries
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions());
  const globalPrefsQuery = useQuery(
    trpc.user.getNotificationPreferences.queryOptions(),
  );

  // Mutations with optimistic updates
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
        typeof domainsQuery.data
      >({ queryKey: domainsQueryKey });

      // Optimistically update the domain's overrides in all query variants
      queryClient.setQueriesData<typeof domainsQuery.data>(
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
        typeof domainsQuery.data
      >({ queryKey: domainsQueryKey });

      // Optimistically reset the domain's overrides in all query variants
      queryClient.setQueriesData<typeof domainsQuery.data>(
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

  if (domainsQuery.isLoading || globalPrefsQuery.isLoading) {
    return <NotificationsSkeleton />;
  }

  if (domainsQuery.isError || globalPrefsQuery.isError) {
    return (
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="mb-1 flex items-center gap-2 leading-none">
          <BellSimpleIcon className="size-4.5" />
          Notification Preferences
        </CardTitle>
        <CardDescription className="text-destructive">
          Failed to load notification settings
        </CardDescription>
      </CardHeader>
    );
  }

  const domains = domainsQuery.data ?? [];
  const verifiedDomains = domains
    .filter((d) => d.verified)
    .sort((a, b) => a.domainName.localeCompare(b.domainName));

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
    ...globalPrefsQuery.data,
  };

  const isPending =
    updateGlobalMutation.isPending ||
    updateDomainMutation.isPending ||
    resetDomainMutation.isPending;

  return (
    <div className="max-w-full overflow-x-hidden">
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="mb-1 flex items-center gap-2 leading-none">
          <GlobeIcon className="size-4.5" />
          Global Preferences
        </CardTitle>
        <CardDescription>
          Alerts will be sent to{" "}
          <span className="whitespace-nowrap rounded-sm border bg-card px-1.5 py-1 font-medium text-foreground">
            {session?.user?.email}
          </span>
          .{" "}
          <span className="text-muted-foreground">
            (
            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                render={
                  <span className="cursor-help underline decoration-dotted underline-offset-3" />
                }
              >
                Why can&rsquo;t I change this?
              </ResponsiveTooltipTrigger>
              <ResponsiveTooltipContent>
                <div className="space-y-2">
                  <p>
                    This is the email address that was verified with the linked
                    account provider you chose at sign up.
                  </p>
                  <p>
                    To change it, you can either sign in again with a different
                    external account, or{" "}
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
            )
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-1">
        {/* Headers */}
        <div className="hidden items-center justify-end gap-2 font-medium text-muted-foreground text-xs sm:flex sm:gap-6">
          <div className="w-12 text-center sm:w-16">Web</div>
          <div className="w-12 text-center sm:w-16">Email</div>
        </div>

        {/* Global Notifications */}
        <div className="space-y-1">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <GlobalNotificationRow
              key={category}
              category={category}
              emailEnabled={globalPrefs[category].email}
              inAppEnabled={globalPrefs[category].inApp}
              onToggle={(type, enabled) =>
                handleGlobalToggle(category, type, enabled)
              }
              disabled={isPending}
            />
          ))}
        </div>
      </CardContent>

      <Separator className="mt-3 mb-6 bg-muted" />

      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="mb-1 flex items-center gap-2 leading-none">
          <SlidersHorizontalIcon className="size-4.5" />
          Domain Preferences
        </CardTitle>
        <CardDescription>
          Override global notifications for individual verified domains.
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-1.5 px-0">
        {/* Per-Domain Overrides Section */}
        {verifiedDomains.length > 0 && (
          <div className="space-y-2">
            {/* Domain Rows */}
            {verifiedDomains.map((domain) => (
              <DomainNotificationRow
                key={domain.id}
                domainName={domain.domainName}
                overrides={domain.notificationOverrides}
                globalPrefs={globalPrefs}
                onToggle={(category, type, value) =>
                  handleDomainToggle(domain.id, category, type, value)
                }
                onReset={() => handleResetDomain(domain.id)}
                disabled={isPending}
              />
            ))}
          </div>
        )}

        {/* Info note */}
        {verifiedDomains.length === 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground text-xs">
              Verify your domains to customize per-domain notifications.
            </p>
          </div>
        )}
      </CardContent>

      <Separator className="my-6 bg-muted" />

      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle className="mb-1 flex items-center gap-2 leading-none">
          <CalendarIcon className="size-4.5" />
          Calendar Feed
        </CardTitle>
        <CardDescription className="[&_a]:font-medium [&_a]:text-primary/85 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-primary">
          Subscribe to domain expiration dates in your calendar app.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-2">
        <CalendarInstructions />
      </CardContent>
    </div>
  );
}
