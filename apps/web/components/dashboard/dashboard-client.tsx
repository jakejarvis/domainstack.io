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

function DashboardActiveView({
  domains,
  filteredDomains,
  archivedCount,
  onShowArchived,
}: {
  domains: TrackedDomainWithDetails[];
  filteredDomains: TrackedDomainWithDetails[];
  archivedCount: number;
  onShowArchived: () => void;
}) {
  return (
    <div className="space-y-4">
      {domains.length > 0 ? <HealthSummary /> : null}
      {domains.length > 0 ? <DashboardFilters /> : null}

      <DashboardContent domains={filteredDomains} totalDomains={domains.length} />

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

export function DashboardClient() {
  const dashboard = useDashboardClient();

  if (dashboard.isLoading || !dashboard.session) {
    return <DashboardSkeleton />;
  }

  if (dashboard.hasError) {
    return <DashboardError onRetry={dashboard.handleRetry} />;
  }

  return (
    <div className="space-y-6">
      <DashboardHeader userName={dashboard.session.user?.name ?? ""} />

      {dashboard.showUpgradedBanner ? (
        <DashboardBannerDismissable
          variant="success"
          icon={IconHeartHandshake}
          title="Welcome to Pro!"
          description={`You now have access to track up to ${dashboard.subscription?.planQuota} domains. Thank you for upgrading!`}
          dismissible
          onDismiss={() => dashboard.setShowUpgradedBanner(false)}
        />
      ) : null}

      <SubscriptionEndingBanner />
      <UpgradeBanner />

      <DashboardProvider
        onVerify={dashboard.handleVerify}
        onRemove={dashboard.handleRemove}
        onArchive={dashboard.handleArchive}
        onUnarchive={dashboard.handleUnarchive}
        onMute={dashboard.handleMute}
        verifyingDomainId={dashboard.verifyingDomainId}
        onBulkArchive={dashboard.handleBulkArchive}
        onBulkDelete={dashboard.handleBulkDelete}
        onBulkMute={dashboard.handleBulkMute}
        isBulkArchiving={dashboard.mutations.isBulkArchiving}
        isBulkDeleting={dashboard.mutations.isBulkDeleting}
        isBulkMuting={dashboard.mutations.isBulkMuting}
        filterHook={dashboard.filterHook}
        sortOption={dashboard.sortOption}
        setSortOption={dashboard.setSortOption}
        paginationHook={dashboard.paginationHook}
      >
        {dashboard.activeTab === "archived" ? (
          <DashboardArchivedView
            domains={dashboard.archivedDomains}
            onShowActive={() => dashboard.setActiveTab("active")}
          />
        ) : (
          <DashboardActiveView
            domains={dashboard.domains}
            filteredDomains={dashboard.filteredDomains}
            archivedCount={dashboard.subscription?.archivedCount ?? 0}
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
