"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  CategoryLabel,
  DomainNotificationRow,
  GlobalNotificationRow,
  SettingsSkeleton,
} from "@/components/dashboard/settings";
import { Button } from "@/components/ui/button";
import {
  Card,
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

interface SettingsContentProps {
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
}

export function SettingsContent({ showCard = true }: SettingsContentProps) {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPerDomainOpen, setIsPerDomainOpen] = useState(false);

  // Query keys for cache manipulation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const globalPrefsQueryKey =
    trpc.tracking.getNotificationPreferences.queryKey();

  // Type for global preferences
  type GlobalPrefs = {
    domainExpiry: boolean;
    certificateExpiry: boolean;
    verificationStatus: boolean;
  };

  // Queries
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions());
  const globalPrefsQuery = useQuery(
    trpc.tracking.getNotificationPreferences.queryOptions(),
  );

  // Mutations with optimistic updates
  const updateGlobalMutation = useMutation({
    ...trpc.tracking.updateGlobalNotificationPreferences.mutationOptions(),
    onMutate: async (newPrefs) => {
      await queryClient.cancelQueries({ queryKey: globalPrefsQueryKey });
      const previousPrefs = queryClient.getQueryData(globalPrefsQueryKey);

      // Optimistically update
      queryClient.setQueryData(
        globalPrefsQueryKey,
        (old: GlobalPrefs | undefined) => (old ? { ...old, ...newPrefs } : old),
      );

      return { previousPrefs };
    },
    onError: (err, _variables, context) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData(globalPrefsQueryKey, context.previousPrefs);
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
    ...trpc.tracking.updateDomainNotificationOverrides.mutationOptions(),
    onMutate: async ({ trackedDomainId, overrides }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      const previousDomains = queryClient.getQueryData(domainsQueryKey);

      // Optimistically update the domain's overrides
      queryClient.setQueryData(
        domainsQueryKey,
        (old: typeof domainsQuery.data) =>
          old?.map((d) =>
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
      );

      return { previousDomains };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDomains) {
        queryClient.setQueryData(domainsQueryKey, context.previousDomains);
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
    ...trpc.tracking.resetDomainNotificationOverrides.mutationOptions(),
    onMutate: async ({ trackedDomainId }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      const previousDomains = queryClient.getQueryData(domainsQueryKey);

      // Optimistically reset the domain's overrides
      queryClient.setQueryData(
        domainsQueryKey,
        (old: typeof domainsQuery.data) =>
          old?.map((d) =>
            d.id === trackedDomainId ? { ...d, notificationOverrides: {} } : d,
          ),
      );

      return { previousDomains };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDomains) {
        queryClient.setQueryData(domainsQueryKey, context.previousDomains);
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
    return <SettingsSkeleton showCard={showCard} />;
  }

  // Surface query errors instead of silently falling back to defaults
  if (domainsQuery.isError || globalPrefsQuery.isError) {
    const errorContent = (
      <>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-destructive">
              Failed to load notification settings.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void domainsQuery.refetch();
                void globalPrefsQuery.refetch();
              }}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </>
    );

    if (!showCard) {
      return <div className="flex flex-col">{errorContent}</div>;
    }
    return <Card>{errorContent}</Card>;
  }

  const domains = domainsQuery.data ?? [];
  const verifiedDomains = domains.filter((d) => d.verified);
  const globalPrefs = globalPrefsQuery.data ?? {
    domainExpiry: true,
    certificateExpiry: true,
    verificationStatus: true,
  };

  const isPending =
    updateGlobalMutation.isPending ||
    updateDomainMutation.isPending ||
    resetDomainMutation.isPending;

  const content = (
    <>
      <CardHeader className="pb-4">
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Alerts will be sent to{" "}
          <span className="font-medium text-foreground">
            {session?.user?.email}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Defaults Section */}
        <div className="space-y-4">
          <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Global Defaults
          </h3>
          <div className="grid gap-3">
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
        </div>

        {/* Per-Domain Overrides Section */}
        {verifiedDomains.length > 0 && (
          <Collapsible open={isPerDomainOpen} onOpenChange={setIsPerDomainOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between p-0 font-medium text-muted-foreground text-sm uppercase tracking-wide hover:bg-transparent hover:text-foreground"
              >
                <span>Per-Domain Overrides</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isPerDomainOpen && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-3">
                {/* Column Headers */}
                <div className="hidden gap-2 px-4 text-muted-foreground text-xs sm:grid sm:grid-cols-[1fr_repeat(3,80px)_40px]">
                  <div />
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

        {verifiedDomains.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Verify your domains to customize per-domain notifications.
          </p>
        )}
      </CardContent>
    </>
  );

  if (!showCard) {
    return <div className="flex flex-col">{content}</div>;
  }

  return <Card>{content}</Card>;
}
