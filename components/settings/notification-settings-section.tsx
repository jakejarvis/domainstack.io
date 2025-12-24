"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DomainNotificationRow } from "@/components/settings/domain-notification-row";
import { GlobalNotificationRow } from "@/components/settings/global-notification-row";
import { NotificationsSkeleton } from "@/components/settings/settings-skeleton";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/lib/auth-client";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import { logger } from "@/lib/logger/client";
import type { UserNotificationPreferences } from "@/lib/schemas";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

interface NotificationSettingsSectionProps {
  className?: string;
  dividerClassName?: string;
}

export function NotificationSettingsSection({
  className,
  dividerClassName,
}: NotificationSettingsSectionProps) {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPerDomainOpen, setIsPerDomainOpen] = useState(false);

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
    onError: (err, _variables, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData<UserNotificationPreferences>(
          globalPrefsQueryKey,
          context.previousPrefs,
        );
      }
      logger.error("Failed to update global settings", err);
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
      const previousDomains =
        queryClient.getQueryData<typeof domainsQuery.data>(domainsQueryKey);

      // Optimistically update the domain's overrides
      queryClient.setQueryData<typeof domainsQuery.data>(
        domainsQueryKey,
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
    onError: (err, _variables, context) => {
      if (context?.previousDomains) {
        queryClient.setQueryData<typeof domainsQuery.data>(
          domainsQueryKey,
          context.previousDomains,
        );
      }
      logger.error("Failed to update domain settings", err);
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
      const previousDomains =
        queryClient.getQueryData<typeof domainsQuery.data>(domainsQueryKey);

      // Optimistically reset the domain's overrides
      queryClient.setQueryData<typeof domainsQuery.data>(
        domainsQueryKey,
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
    onError: (err, _variables, context) => {
      if (context?.previousDomains) {
        queryClient.setQueryData<typeof domainsQuery.data>(
          domainsQueryKey,
          context.previousDomains,
        );
      }
      logger.error("Failed to reset domain settings", err);
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
    const key = type === "email" ? category : `${category}InApp`;
    updateGlobalMutation.mutate({ [key]: enabled });
  };

  const handleDomainToggle = (
    trackedDomainId: string,
    category: NotificationCategory,
    type: "email" | "inApp",
    value: boolean | undefined, // undefined = inherit
  ) => {
    const key = type === "email" ? category : `${category}InApp`;
    updateDomainMutation.mutate({
      trackedDomainId,
      overrides: { [key]: value },
    });
  };

  const handleResetDomain = (trackedDomainId: string) => {
    resetDomainMutation.mutate({ trackedDomainId });
  };

  if (domainsQuery.isLoading || globalPrefsQuery.isLoading) {
    return <NotificationsSkeleton />;
  }

  if (domainsQuery.isError || globalPrefsQuery.isError) {
    // Log query errors for observability
    if (domainsQuery.isError) {
      logger.error(
        "Failed to load domains for notifications",
        domainsQuery.error,
      );
    }
    if (globalPrefsQuery.isError) {
      logger.error(
        "Failed to load notification preferences",
        globalPrefsQuery.error,
      );
    }

    return (
      <div>
        <CardHeader className="px-0 pt-0 pb-2">
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load notification settings
          </CardDescription>
        </CardHeader>
      </div>
    );
  }

  const domains = domainsQuery.data ?? [];
  const verifiedDomains = domains
    .filter((d) => d.verified)
    .sort((a, b) => a.domainName.localeCompare(b.domainName));

  const defaultGlobalPrefs: UserNotificationPreferences = {
    ...Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, true])),
    ...Object.fromEntries(
      NOTIFICATION_CATEGORIES.map((c) => [`${c}InApp`, true]),
    ),
  } as UserNotificationPreferences;

  const globalPrefs = globalPrefsQuery.data ?? defaultGlobalPrefs;

  const isPending =
    updateGlobalMutation.isPending ||
    updateDomainMutation.isPending ||
    resetDomainMutation.isPending;

  return (
    <div className={className}>
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Alerts will be sent to{" "}
          <span className="font-medium text-foreground">
            {session?.user?.email}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5 px-0 pt-1">
        {/* Headers */}
        <div className="flex items-center justify-end gap-2 px-3 font-medium text-muted-foreground text-xs sm:gap-6">
          <div className="w-12 text-center sm:w-16">In-App</div>
          <div className="w-12 text-center sm:w-16">Email</div>
        </div>

        {/* Global Notifications */}
        <div className="space-y-1">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <GlobalNotificationRow
              key={category}
              category={category}
              emailEnabled={globalPrefs[category]}
              inAppEnabled={globalPrefs[`${category}InApp`] as boolean}
              onToggle={(type, enabled) =>
                handleGlobalToggle(category, type, enabled)
              }
              disabled={isPending}
            />
          ))}
        </div>

        {/* Divider */}
        <Separator className={cn("mt-2 mb-4 bg-border/50", dividerClassName)} />

        {/* Per-Domain Overrides Section */}
        {verifiedDomains.length > 0 && (
          <Collapsible open={isPerDomainOpen} onOpenChange={setIsPerDomainOpen}>
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium text-[13px] text-foreground/85">
                    Per-domain overrides
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-200",
                      isPerDomainOpen && "rotate-180",
                    )}
                  />
                </button>
              }
            />
            <CollapsibleContent className="mt-4">
              <div className="space-y-2">
                {/* Headers for domain section */}
                <div className="flex items-center justify-end gap-2 px-3 font-medium text-muted-foreground text-xs sm:gap-6">
                  <div className="w-12 text-center sm:w-16">In-App</div>
                  <div className="w-12 text-center sm:w-16">Email</div>
                </div>

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
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Info note */}
        {verifiedDomains.length === 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground text-xs">
              Verify your domains to customize per-domain notifications.
            </p>
          </div>
        )}
      </CardContent>
    </div>
  );
}
