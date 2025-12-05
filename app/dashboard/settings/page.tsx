"use client";

import { useQuery } from "@tanstack/react-query";
import { SettingsContent } from "@/components/dashboard/settings-content";
import { SubscriptionSection } from "@/components/dashboard/subscription-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";

export default function SettingsPage() {
  const trpc = useTRPC();
  const limitsQuery = useQuery(trpc.tracking.getLimits.queryOptions());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">Settings</h1>
        <p className="text-muted-foreground">
          Manage your subscription and notification preferences.
        </p>
      </div>

      {/* Subscription section */}
      {limitsQuery.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : limitsQuery.isError ? (
        <p className="text-destructive text-sm">
          Unable to load subscription details. Please try again later.
        </p>
      ) : limitsQuery.data ? (
        <SubscriptionSection
          tier={limitsQuery.data.tier}
          activeCount={limitsQuery.data.activeCount}
          maxDomains={limitsQuery.data.maxDomains}
        />
      ) : null}

      {/* Notification settings */}
      <SettingsContent />
    </div>
  );
}
