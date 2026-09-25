"use client";

import { IconArchive, IconArrowLeft, IconHeartHandshake } from "@tabler/icons-react";

import { ArchivedDomainsList } from "@/components/dashboard/archived-domains-list";
import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { DashboardConfirmDialog } from "@/components/dashboard/dashboard-confirm-dialog";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { HealthSummary } from "@/components/dashboard/health-summary";
import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { DashboardProvider } from "@/context/dashboard-context";
import { useDashboardClient } from "@/hooks/use-dashboard-client";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { useIsClient } from "@domainstack/ui/hooks";

function DashboardActiveView({
  totalDomains,
  archivedCount,
  onShowArchived,
}: {
  totalDomains: number;
  archivedCount: number;
  onShowArchived: () => void;
}) {
  return (
    <div className="space-y-4">
      {totalDomains > 0 ? <HealthSummary /> : null}
      {totalDomains > 0 ? <DashboardFilters /> : null}

      <DashboardContent totalDomains={totalDomains} />

      {archivedCount > 0 ? (
        <div className="pt-4 text-center">
          <Button
            variant="ghost"
            onClick={onShowArchived}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <IconArchive />
            View {archivedCount} archived domain
            {archivedCount !== 1 ? "s" : ""}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DashboardArchivedView({
  domains,
  onShowActive,
}: {
  domains: TrackedDomainWithDetails[];
  onShowActive: () => void;
}) {
  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={onShowActive}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft />
        Back to domains
      </Button>

      <ArchivedDomainsList domains={domains} />
    </div>
  );
}

export function DashboardClient({ userName }: { userName: string }) {
  const dashboard = useDashboardClient();
  const mounted = useIsClient();

  if (!mounted || dashboard.isLoading) {
    return <DashboardSkeleton />;
  }

  if (dashboard.hasError) {
    return <DashboardError onRetry={dashboard.handleRetry} />;
  }

  return (
    <div className="space-y-6">
      <DashboardHeader userName={userName} />

      {dashboard.showUpgradedBanner ? (
        <DashboardBannerDismissable
          variant="success"
          icon={IconHeartHandshake}
          title="Welcome to Pro!"
          description={
            dashboard.subscription?.plan === "pro"
              ? `You now have access to track up to ${dashboard.subscription.planQuota} domains. Thank you for upgrading!`
              : "We're processing your upgrade. Pro access will appear here once your payment is confirmed."
          }
          dismissible
          onDismiss={() => dashboard.setShowUpgradedBanner(false)}
        />
      ) : null}

      <SubscriptionEndingBanner />
      <UpgradeBanner />

      <DashboardProvider
        domains={dashboard.domains}
        actions={dashboard.actions}
        bulk={dashboard.bulk}
      >
        {dashboard.activeTab === "archived" ? (
          <DashboardArchivedView
            domains={dashboard.archivedDomains}
            onShowActive={() => dashboard.setActiveTab("active")}
          />
        ) : (
          <DashboardActiveView
            totalDomains={dashboard.domains.length}
            archivedCount={dashboard.archivedDomains.length}
            onShowArchived={() => dashboard.setActiveTab("archived")}
          />
        )}
      </DashboardProvider>

      <DashboardConfirmDialog
        pendingAction={dashboard.pendingAction}
        onOpenChange={(open) => {
          if (!open) dashboard.setPendingAction(null);
        }}
        onConfirm={dashboard.handleConfirm}
      />
    </div>
  );
}
