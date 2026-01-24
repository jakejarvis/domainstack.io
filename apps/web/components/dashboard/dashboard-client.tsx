"use client";

import {
  ArchiveIcon,
  ArrowLeftIcon,
  HandHeartIcon,
} from "@phosphor-icons/react/ssr";
import type { Table } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { ArchivedDomainsList } from "@/components/dashboard/archived-domains-list";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { HealthSummary } from "@/components/dashboard/health-summary";
import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { Button } from "@/components/ui/button";
import { useBulkOperations } from "@/hooks/use-bulk-operations";
import {
  type ConfirmAction,
  useConfirmAction,
} from "@/hooks/use-confirm-action";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";
import { useDashboardSelection } from "@/hooks/use-dashboard-selection";
import { useDashboardGridSort } from "@/hooks/use-dashboard-sort";
import { useRouter } from "@/hooks/use-router";
import { useSubscription } from "@/hooks/use-subscription";
import { useTrackedDomains } from "@/hooks/use-tracked-domains";
import { useSession } from "@/lib/auth-client";
import { sortDomains } from "@/lib/dashboard-utils";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";

export function DashboardClient() {
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);
  const [activeTab, setActiveTab] = useQueryState(
    "view",
    parseAsStringLiteral(["active", "archived"])
      .withDefault("active")
      .withOptions({ shallow: true, clearOnDefault: true }),
  );
  const { viewMode, setViewMode } = useDashboardPreferences();
  const [sortOption, setSortOption] = useDashboardGridSort();
  const [tableInstance, setTableInstance] =
    useState<Table<TrackedDomainWithDetails> | null>(null);
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();

  const {
    subscription,
    isSubscriptionLoading: subscriptionLoading,
    isSubscriptionError: subscriptionError,
    refetchSubscription,
  } = useSubscription();

  const {
    domains: allDomains,
    isLoading: domainsLoading,
    isError: domainsError,
    refetch: refetchDomains,
    removeMutation,
    archiveMutation,
    unarchiveMutation,
    muteMutation,
  } = useTrackedDomains({ includeArchived: true });

  const domains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt === null) ?? [],
    [allDomains],
  );
  const archivedDomains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt !== null) ?? [],
    [allDomains],
  );
  const totalDomainsCount = domains.length;

  const [, startTransition] = useTransition();

  const {
    search,
    status,
    health,
    tlds,
    providers,
    domainId,
    filteredDomainName,
    setSearch: setSearchImmediate,
    setStatus: setStatusImmediate,
    setHealth: setHealthImmediate,
    setTlds: setTldsImmediate,
    setProviders: setProvidersImmediate,
    clearDomainId,
    filteredDomains: filteredUnsorted,
    availableTlds,
    availableProviders,
    hasActiveFilters,
    clearFilters,
    applyHealthFilter,
    stats,
  } = useDashboardFilters(domains);

  // Wrap filter setters with startTransition for non-blocking updates
  const setSearch = useCallback(
    (value: string) => startTransition(() => setSearchImmediate(value)),
    [setSearchImmediate],
  );
  const setStatus = useCallback(
    (value: Parameters<typeof setStatusImmediate>[0]) =>
      startTransition(() => setStatusImmediate(value)),
    [setStatusImmediate],
  );
  const setHealth = useCallback(
    (value: Parameters<typeof setHealthImmediate>[0]) =>
      startTransition(() => setHealthImmediate(value)),
    [setHealthImmediate],
  );
  const setTlds = useCallback(
    (value: Parameters<typeof setTldsImmediate>[0]) =>
      startTransition(() => setTldsImmediate(value)),
    [setTldsImmediate],
  );
  const setProviders = useCallback(
    (value: Parameters<typeof setProvidersImmediate>[0]) =>
      startTransition(() => setProvidersImmediate(value)),
    [setProvidersImmediate],
  );

  // Apply sorting after filtering (only for grid view - table has its own column sorting)
  const filteredDomains = useMemo(
    () =>
      viewMode === "grid"
        ? sortDomains(filteredUnsorted, sortOption)
        : filteredUnsorted,
    [filteredUnsorted, sortOption, viewMode],
  );

  // Selection state for bulk operations
  const filteredDomainIds = useMemo(
    () => filteredDomains.map((d) => d.id),
    [filteredDomains],
  );
  const selection = useDashboardSelection(filteredDomainIds);

  // Bulk operations
  const {
    isBulkArchiving,
    isBulkDeleting,
    executeBulkArchive,
    executeBulkDelete,
  } = useBulkOperations({
    onComplete: selection.clearSelection,
  });

  // Confirmation dialog
  const handleConfirmAction = useCallback(
    (action: ConfirmAction) => {
      if (action.type === "remove") {
        removeMutation.mutate({ trackedDomainId: action.domainId });
      } else if (action.type === "archive") {
        archiveMutation.mutate({ trackedDomainId: action.domainId });
      } else if (action.type === "bulk-archive") {
        void executeBulkArchive(action.domainIds);
      } else if (action.type === "bulk-delete") {
        void executeBulkDelete(action.domainIds);
      }
    },
    [removeMutation, archiveMutation, executeBulkArchive, executeBulkDelete],
  );

  const confirmAction = useConfirmAction({
    onConfirm: handleConfirmAction,
  });

  // Handle ?upgraded=true query param (after nuqs adapter)
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("upgraded") === "true") {
      setShowUpgradedBanner(true);
      // Clear only the `upgraded` param while preserving others (e.g., filters)
      const params = new URLSearchParams(searchParams.toString());
      params.delete("upgraded");
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : "");
      router.replace(newUrl, { scroll: false });
    }
  }, [router, searchParams]);

  const handleAddDomain = useCallback(() => {
    router.push("/dashboard/add-domain", { scroll: false });
  }, [router]);

  const handleVerify = useCallback(
    (domain: TrackedDomainWithDetails) => {
      const params = new URLSearchParams({
        resume: "true",
        id: domain.id,
      });

      if (domain.verificationMethod) {
        params.set("method", domain.verificationMethod);
      }

      router.push(`/dashboard/add-domain?${params.toString()}`, {
        scroll: false,
      });
    },
    [router],
  );

  const handleRemove = useCallback(
    (id: string, domainName: string) => {
      confirmAction.requestConfirmation({
        type: "remove",
        domainId: id,
        domainName,
      });
    },
    [confirmAction],
  );

  const handleArchive = useCallback(
    (id: string, domainName: string) => {
      confirmAction.requestConfirmation({
        type: "archive",
        domainId: id,
        domainName,
      });
    },
    [confirmAction],
  );

  const handleBulkArchive = useCallback(() => {
    const domainIds = selection.selectedArray;
    if (domainIds.length === 0) return;
    confirmAction.requestConfirmation({
      type: "bulk-archive",
      domainIds,
      count: domainIds.length,
    });
  }, [selection.selectedArray, confirmAction]);

  const handleBulkDelete = useCallback(() => {
    const domainIds = selection.selectedArray;
    if (domainIds.length === 0) return;
    confirmAction.requestConfirmation({
      type: "bulk-delete",
      domainIds,
      count: domainIds.length,
    });
  }, [selection.selectedArray, confirmAction]);

  const handleUnarchive = useCallback(
    (id: string) => {
      unarchiveMutation.mutate({ trackedDomainId: id });
    },
    [unarchiveMutation],
  );

  const handleToggleMuted = useCallback(
    (id: string, muted: boolean) => {
      muteMutation.mutate({ trackedDomainId: id, muted });
    },
    [muteMutation],
  );

  // Show loading until we have both query data AND session data
  const isLoading =
    subscriptionLoading || domainsLoading || sessionLoading || !session;

  const hasError = subscriptionError || domainsError;

  const handleRetry = useCallback(() => {
    refetchSubscription();
    refetchDomains();
  }, [refetchSubscription, refetchDomains]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (hasError) {
    return <DashboardError onRetry={handleRetry} />;
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        userName={session?.user?.name ?? ""}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Pro upgrade success banner */}
      {showUpgradedBanner && (
        <DashboardBannerDismissable
          variant="success"
          icon={HandHeartIcon}
          title="Welcome to Pro!"
          description={`You now have access to track up to ${subscription?.planQuota} domains. Thank you for upgrading!`}
          dismissible
          onDismiss={() => setShowUpgradedBanner(false)}
        />
      )}

      {/* Subscription ending banner for users who canceled */}
      <SubscriptionEndingBanner />

      {/* Upgrade prompt when free user is near or at limit */}
      <UpgradeBanner />

      {/* Active domains view */}
      {activeTab === "active" && (
        <div className="space-y-4">
          {/* Health summary - only show when there are domains */}
          {domains.length > 0 && (
            <HealthSummary
              expiringSoon={stats.expiringSoon}
              pendingVerification={stats.pendingVerification}
              onExpiringClick={() => applyHealthFilter("expiring")}
              onPendingClick={() => applyHealthFilter("pending")}
            />
          )}

          {/* Filters - only show when there are domains */}
          {domains.length > 0 && (
            <DashboardFilters
              search={search}
              status={status}
              health={health}
              tlds={tlds}
              providers={providers}
              availableTlds={availableTlds}
              availableProviders={availableProviders}
              onSearchChange={setSearch}
              onStatusChange={setStatus}
              onHealthChange={setHealth}
              onTldsChange={setTlds}
              onProvidersChange={setProviders}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              domainId={domainId}
              filteredDomainName={filteredDomainName}
              onClearDomainId={clearDomainId}
              viewMode={viewMode}
              sortOption={sortOption}
              onSortChange={setSortOption}
              table={viewMode === "table" ? tableInstance : null}
            />
          )}

          <DashboardContent
            viewMode={viewMode}
            domains={filteredDomains}
            totalDomains={totalDomainsCount}
            hasActiveFilters={hasActiveFilters}
            selection={selection}
            onAddDomain={handleAddDomain}
            onVerify={handleVerify}
            onRemove={handleRemove}
            onArchive={handleArchive}
            onToggleMuted={handleToggleMuted}
            onBulkArchive={handleBulkArchive}
            onBulkDelete={handleBulkDelete}
            onTableReady={setTableInstance}
            onClearFilters={clearFilters}
            isBulkArchiving={isBulkArchiving}
            isBulkDeleting={isBulkDeleting}
          />

          {/* Link to archived domains - only show when there are archived domains */}
          {subscription?.archivedCount && subscription.archivedCount > 0 ? (
            <div className="pt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setActiveTab("archived")}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArchiveIcon />
                View {subscription?.archivedCount} archived domain
                {subscription?.archivedCount !== 1 && "s"}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {/* Archived domains view */}
      {activeTab === "archived" && (
        <div className="space-y-4">
          {/* Back to active domains */}
          <Button
            variant="ghost"
            onClick={() => setActiveTab("active")}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon />
            Back to domains
          </Button>

          <ArchivedDomainsList
            domains={archivedDomains}
            onUnarchive={handleUnarchive}
            onRemove={handleRemove}
          />
        </div>
      )}

      {/* Confirmation dialog for destructive actions */}
      <ConfirmActionDialog
        open={confirmAction.isOpen}
        onOpenChange={(open) => {
          if (!open) confirmAction.cancel();
        }}
        content={confirmAction.dialogContent}
        onConfirm={confirmAction.confirm}
      />
    </div>
  );
}
