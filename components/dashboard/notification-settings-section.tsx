"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  CategoryLabel,
  DomainNotificationRow,
  GlobalNotificationRow,
} from "@/components/dashboard/settings";
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
import { useSession } from "@/lib/auth-client";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export function NotificationSettingsSection() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPerDomainOpen, setIsPerDomainOpen] = useState(false);

  // Query keys for cache manipulation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const globalPrefsQueryKey = trpc.user.getNotificationPreferences.queryKey();

  // Type for global preferences - derived from notification constants
  type GlobalPrefs = Record<NotificationCategory, boolean>;

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
        queryClient.getQueryData<GlobalPrefs>(globalPrefsQueryKey);

      // Optimistically update
      queryClient.setQueryData<GlobalPrefs>(globalPrefsQueryKey, (old) =>
        old ? { ...old, ...newPrefs } : old,
      );

      return { previousPrefs };
    },
    onError: (err, _variables, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData<GlobalPrefs>(
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
            ? {
                ...old,
                items: old.items.map((d) =>
                  d.id === trackedDomainId
                    ? {
                        ...d,
                        notificationOverrides: {
                          ...(d.notificationOverrides ?? {}),
                          ...overrides,
                        },
                      }
                    : d,
                ),
              }
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
            ? {
                ...old,
                items: old.items.map((d) =>
                  d.id === trackedDomainId
                    ? { ...d, notificationOverrides: {} }
                    : d,
                ),
              }
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

  // Simplified handlers - no try/catch needed, mutations handle errors
  const handleGlobalToggle = (
    category: NotificationCategory,
    enabled: boolean,
  ) => {
    updateGlobalMutation.mutate({ [category]: enabled });
  };

  const handleDomainToggle = (
    trackedDomainId: string,
    category: NotificationCategory,
    value: boolean | undefined, // undefined = inherit
  ) => {
    updateDomainMutation.mutate({
      trackedDomainId,
      overrides: { [category]: value },
    });
  };

  const handleResetDomain = (trackedDomainId: string) => {
    resetDomainMutation.mutate({ trackedDomainId });
  };

  if (domainsQuery.isLoading || globalPrefsQuery.isLoading) {
    return (
      <div>
        <CardHeader className="px-0 pt-0 pb-2">
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </div>
    );
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
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load notification settings
          </CardDescription>
        </CardHeader>
      </div>
    );
  }

  const domains = domainsQuery.data?.items ?? [];
  const verifiedDomains = domains.filter((d) => d.verified);

  const defaultGlobalPrefs: GlobalPrefs = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [category, true]),
  ) as GlobalPrefs;

  const globalPrefs = globalPrefsQuery.data ?? defaultGlobalPrefs;

  const isPending =
    updateGlobalMutation.isPending ||
    updateDomainMutation.isPending ||
    resetDomainMutation.isPending;

  return (
    <div>
      <CardHeader className="px-0 pt-0 pb-2">
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Alerts will be sent to{" "}
          <span className="font-medium text-foreground">
            {session?.user?.email}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-0 pt-1">
        {/* Global Notifications */}
        <div className="space-y-1">
          {NOTIFICATION_CATEGORIES.map((category) => (
            <GlobalNotificationRow
              key={category}
              category={category}
              enabled={globalPrefs[category]}
              onToggle={(enabled) => handleGlobalToggle(category, enabled)}
              disabled={isPending}
            />
          ))}
        </div>

        {/* Per-Domain Overrides Section */}
        {verifiedDomains.length > 0 && (
          <Collapsible open={isPerDomainOpen} onOpenChange={setIsPerDomainOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/50"
              >
                <span className="font-medium text-muted-foreground text-xs">
                  Per-domain overrides
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    isPerDomainOpen && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2">
                {/* Column Headers */}
                <div className="hidden gap-2 px-3 text-[10px] text-muted-foreground uppercase tracking-wider sm:grid sm:grid-cols-[1fr_repeat(3,72px)_36px]">
                  <div>Domain</div>
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <div
                      key={category}
                      className="flex items-center justify-center"
                    >
                      <CategoryLabel category={category} compact />
                    </div>
                  ))}
                  <div />
                </div>

                {/* Domain Rows */}
                {verifiedDomains.map((domain) => (
                  <DomainNotificationRow
                    key={domain.id}
                    domainName={domain.domainName}
                    overrides={domain.notificationOverrides}
                    globalPrefs={globalPrefs}
                    onToggle={(category, value) =>
                      handleDomainToggle(domain.id, category, value)
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
