"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ChevronDown,
  Crown,
  ExternalLink,
  Info,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteAccountDialog } from "@/components/dashboard/delete-account-dialog";
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
import { Progress } from "@/components/ui/progress";
import { useCustomerPortal } from "@/hooks/use-customer-portal";
import { useUpgradeCheckout } from "@/hooks/use-upgrade-checkout";
import { useSession } from "@/lib/auth-client";
import { DEFAULT_TIER_LIMITS } from "@/lib/constants";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import { logger } from "@/lib/logger/client";
import { getProTierInfo } from "@/lib/polar/products";
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
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Subscription hooks
  const { handleUpgrade, isLoading: isCheckoutLoading } = useUpgradeCheckout();
  const { openPortal: handleManageSubscription, isLoading: isPortalLoading } =
    useCustomerPortal();

  // Query keys for cache manipulation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const globalPrefsQueryKey =
    trpc.tracking.getNotificationPreferences.queryKey();

  // Type for global preferences - derived from notification constants
  type GlobalPrefs = Record<NotificationCategory, boolean>;

  // Queries
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions());
  const globalPrefsQuery = useQuery(
    trpc.tracking.getNotificationPreferences.queryOptions(),
  );
  const limitsQuery = useQuery(trpc.tracking.getLimits.queryOptions());

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

  const isLoading =
    domainsQuery.isLoading ||
    globalPrefsQuery.isLoading ||
    limitsQuery.isLoading;

  if (isLoading) {
    return <SettingsSkeleton showCard={showCard} />;
  }

  // Surface query errors instead of silently falling back to defaults
  if (domainsQuery.isError || globalPrefsQuery.isError || limitsQuery.isError) {
    const errorContent = (
      <>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-destructive">Failed to load settings.</p>
            <Button
              variant="outline"
              onClick={() => {
                void domainsQuery.refetch();
                void globalPrefsQuery.refetch();
                void limitsQuery.refetch();
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
  const limits = limitsQuery.data;

  const isPending =
    updateGlobalMutation.isPending ||
    updateDomainMutation.isPending ||
    resetDomainMutation.isPending;

  // Subscription data
  const isPro = limits?.tier === "pro";
  const activeCount = limits?.activeCount ?? 0;
  const maxDomains = limits?.maxDomains ?? DEFAULT_TIER_LIMITS.free;
  const proMaxDomains = limits?.proMaxDomains ?? DEFAULT_TIER_LIMITS.pro;
  const subscriptionEndsAt = limits?.subscriptionEndsAt ?? null;
  const percentage =
    maxDomains > 0 ? Math.min((activeCount / maxDomains) * 100, 100) : 0;
  const proTierInfo = getProTierInfo(proMaxDomains);

  const content = (
    <div className={cn("space-y-6", !showCard && "py-1")}>
      {/* Subscription Section */}
      <div>
        <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
          <CardTitle className="flex items-center gap-2">
            {isPro && <Crown className="size-5 text-accent-purple" />}
            Subscription
          </CardTitle>
          <CardDescription>
            {isPro
              ? "You're on the Pro plan. Thank you for your support!"
              : "Upgrade to Pro for more tracked domains."}
          </CardDescription>
        </CardHeader>
        <CardContent className={showCard ? "space-y-4" : "space-y-4 px-0"}>
          {/* Current plan info */}
          <div className="flex items-center justify-between rounded-xl border border-black/10 bg-muted/30 p-4 dark:border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {isPro ? "Pro" : "Free"} Plan
                </span>
                {isPro && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      subscriptionEndsAt
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-accent-purple/10 text-accent-purple",
                    )}
                  >
                    {subscriptionEndsAt
                      ? `Ends ${format(subscriptionEndsAt, "MMM d")}`
                      : "Active"}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {activeCount} of {maxDomains} domains used
              </p>
            </div>
            <Progress
              value={percentage}
              className="w-24"
              aria-label="Domain usage"
              aria-valuetext={`${activeCount} of ${maxDomains} domains used`}
            />
          </div>

          {/* Actions */}
          {isPro ? (
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={isPortalLoading}
                className="w-full"
              >
                <ExternalLink className="size-4" />
                {isPortalLoading ? "Opening..." : "Manage Subscription"}
              </Button>
              {subscriptionEndsAt && (
                <p className="text-center text-muted-foreground text-xs">
                  Your Pro access continues until{" "}
                  {format(subscriptionEndsAt, "MMMM d, yyyy")}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-accent-purple/20 bg-gradient-to-br from-accent-purple/5 to-accent-blue/5 p-4">
                <div className="mb-2 font-medium">{proTierInfo.name}</div>
                <ul className="mb-3 space-y-1 text-muted-foreground text-sm">
                  {proTierInfo.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-semibold text-accent-purple">
                    {proTierInfo.monthly.label}
                  </span>
                  <span className="text-muted-foreground">or</span>
                  <span className="font-semibold text-accent-purple">
                    {proTierInfo.yearly.label}
                  </span>
                  <span className="text-muted-foreground/70 text-xs">
                    ({proTierInfo.yearly.savings})
                  </span>
                </div>
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={isCheckoutLoading}
                className="w-full bg-accent-purple hover:bg-accent-purple/90"
              >
                <Crown className="size-4" />
                {isCheckoutLoading ? "Opening..." : "Upgrade to Pro"}
              </Button>
            </div>
          )}
        </CardContent>
      </div>

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard ? "mx-6" : "")} />

      {/* Email Notifications Section */}
      <div>
        <CardHeader className={showCard ? "pb-2" : "px-0 pt-0 pb-2"}>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Alerts will be sent to{" "}
            <span className="font-medium text-foreground">
              {session?.user?.email}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className={showCard ? "space-y-5" : "space-y-5 px-0 pb-0"}>
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
            <Collapsible
              open={isPerDomainOpen}
              onOpenChange={setIsPerDomainOpen}
            >
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

      {/* Divider */}
      <div className={cn("h-px bg-border/50", showCard ? "mx-6" : "")} />

      {/* Danger Zone Section - Collapsible */}
      <Collapsible
        open={isDangerZoneOpen}
        onOpenChange={setIsDangerZoneOpen}
        className={showCard ? "px-6" : ""}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "group flex w-full items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-left transition-all",
              "hover:border-destructive/30 hover:bg-destructive/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2",
              isDangerZoneOpen && "rounded-b-none border-b-0",
            )}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-4 text-destructive" />
              <div>
                <span className="font-medium text-destructive text-sm">
                  Danger Zone
                </span>
                <p className="text-muted-foreground text-xs">
                  Irreversible account actions
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "size-4 text-destructive/60 transition-transform duration-200",
                isDangerZoneOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in">
          <div className="rounded-b-xl border border-destructive/20 border-t-0 bg-destructive/5 p-4">
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
                className="shrink-0"
              >
                Delete Account
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <DeleteAccountDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </div>
  );

  if (!showCard) {
    return content;
  }

  return <Card className="overflow-hidden">{content}</Card>;
}
