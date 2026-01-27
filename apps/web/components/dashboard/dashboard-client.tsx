"use client";

import {
  IconArchive,
  IconArrowLeft,
  IconHeartHandshake,
} from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";
import { usePathname, useSearchParams } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { ArchivedDomainsList } from "@/components/dashboard/archived-domains-list";
import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { HealthSummary } from "@/components/dashboard/health-summary";
import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useDashboardPagination } from "@/hooks/use-dashboard-pagination";
import { useDashboardSelection } from "@/hooks/use-dashboard-selection";
import { useDashboardGridSort } from "@/hooks/use-dashboard-sort";
import { useRouter } from "@/hooks/use-router";
import { useSubscription } from "@/hooks/use-subscription";
import { useTrackedDomains } from "@/hooks/use-tracked-domains";
import { useSession } from "@/lib/auth-client";
import { sortDomains } from "@/lib/dashboard-utils";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";

type ConfirmAction =
  | { type: "remove"; domainId: string; domainName: string }
  | { type: "archive"; domainId: string; domainName: string }
  | { type: "bulk-archive"; domainIds: string[]; count: number }
  | { type: "bulk-delete"; domainIds: string[]; count: number };

function getConfirmDialogContent(action: ConfirmAction) {
  switch (action.type) {
    case "remove":
      return {
        title: "Remove domain?",
        description: `Are you sure you want to stop tracking ${action.domainName}?`,
        confirmLabel: "Remove",
        variant: "destructive" as const,
      };
    case "archive":
      return {
        title: "Archive domain?",
        description: `Are you sure you want to archive ${action.domainName}? You can reactivate it later from the Archived section.`,
        confirmLabel: "Archive",
        variant: "default" as const,
      };
    case "bulk-archive":
      return {
        title: `Archive ${action.count} domains?`,
        description: `Are you sure you want to archive ${action.count} domain${action.count === 1 ? "" : "s"}? You can reactivate them later from the Archived section.`,
        confirmLabel: "Archive All",
        variant: "default" as const,
      };
    case "bulk-delete":
      return {
        title: `Delete ${action.count} domains?`,
        description: `Are you sure you want to stop tracking ${action.count} domain${action.count === 1 ? "" : "s"}?`,
        confirmLabel: "Delete All",
        variant: "destructive" as const,
      };
  }
}

export function DashboardClient() {
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);
  const [activeTab, setActiveTab] = useQueryState(
    "view",
    parseAsStringLiteral(["active", "archived"])
      .withDefault("active")
      .withOptions({ shallow: true, clearOnDefault: true }),
  );
  const viewMode = usePreferencesStore((s) => s.viewMode);
  const setViewMode = usePreferencesStore((s) => s.setViewMode);
  const [sortOption, setSortOption] = useDashboardGridSort();
  const { pagination, setPageIndex } = useDashboardPagination();
  const snapshot = useDashboardStore((s) => s.snapshot);
  const captureSnapshot = useDashboardStore((s) => s.captureSnapshot);
  const clearSnapshot = useDashboardStore((s) => s.clearSnapshot);
  const pathname = usePathname();
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
    bulkArchiveMutation,
    bulkDeleteMutation,
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

  // Track previous pathname to detect navigation away from/to dashboard
  const prevPathnameRef = useRef(pathname);

  // Effect event to restore snapshot - reads latest snapshot without being a dependency
  const onRestoreSnapshot = useEffectEvent(() => {
    if (!snapshot) return;
    setSearchImmediate(snapshot.search);
    setStatusImmediate(snapshot.status);
    setHealthImmediate(snapshot.health);
    setTldsImmediate(snapshot.tlds);
    setProvidersImmediate(snapshot.providers);
    setSortOption(snapshot.sort);
    setPageIndex(snapshot.page);
    if (snapshot.view !== "active") {
      setActiveTab(snapshot.view);
    }
    clearSnapshot();
  });

  // Effect event to capture snapshot - reads latest filter values without them being dependencies
  const onCaptureSnapshot = useEffectEvent(() => {
    captureSnapshot({
      search,
      status,
      health,
      tlds,
      providers,
      domainId,
      sort: sortOption,
      page: pagination.pageIndex,
      view: activeTab ?? "active",
    });
  });

  // Restore snapshot when returning to /dashboard from an intercepted route
  useLayoutEffect(() => {
    const wasOnDashboard = prevPathnameRef.current === "/dashboard";
    const isOnDashboard = pathname === "/dashboard";

    if (!wasOnDashboard && isOnDashboard) {
      onRestoreSnapshot();
    }

    prevPathnameRef.current = pathname;
  }, [pathname]);

  // Capture snapshot when navigating away from /dashboard
  // For intercepted routes (modals), this component stays mounted and the snapshot is preserved
  // For full navigations, the unmount cleanup below will clear it
  useEffect(() => {
    const wasOnDashboard = prevPathnameRef.current === "/dashboard";
    const isOnDashboard = pathname === "/dashboard";

    if (wasOnDashboard && !isOnDashboard) {
      onCaptureSnapshot();
    }
  }, [pathname]);

  // Clear snapshot on unmount (full navigation away, not intercepted route)
  // This prevents stale snapshots from being restored if user navigates
  // to a different page entirely and then comes back to dashboard
  useEffect(() => clearSnapshot, [clearSnapshot]);

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
  const isBulkArchiving = bulkArchiveMutation.isPending;
  const isBulkDeleting = bulkDeleteMutation.isPending;

  const doBulkArchive = useCallback(
    async (domainIds: string[]) => {
      try {
        const result = await bulkArchiveMutation.mutateAsync({
          trackedDomainIds: domainIds,
        });
        selection.clearSelection();
        if (result.failedCount === 0) {
          toast.success(
            `Archived ${result.successCount} domain${result.successCount === 1 ? "" : "s"}`,
          );
        } else {
          toast.warning(
            `Archived ${result.successCount} of ${domainIds.length} domains (${result.failedCount} failed)`,
          );
        }
      } catch {
        // Error handled in mutation onError
      }
    },
    [bulkArchiveMutation, selection],
  );

  const doBulkDelete = useCallback(
    async (domainIds: string[]) => {
      try {
        const result = await bulkDeleteMutation.mutateAsync({
          trackedDomainIds: domainIds,
        });
        selection.clearSelection();
        if (result.failedCount === 0) {
          toast.success(
            `Deleted ${result.successCount} domain${result.successCount === 1 ? "" : "s"}`,
          );
        } else {
          toast.warning(
            `Deleted ${result.successCount} of ${domainIds.length} domains (${result.failedCount} failed)`,
          );
        }
      } catch {
        // Error handled in mutation onError
      }
    },
    [bulkDeleteMutation, selection],
  );

  // Confirmation dialog - local state
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(
    null,
  );

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;
    if (pendingAction.type === "remove") {
      removeMutation.mutate({ trackedDomainId: pendingAction.domainId });
    } else if (pendingAction.type === "archive") {
      archiveMutation.mutate({ trackedDomainId: pendingAction.domainId });
    } else if (pendingAction.type === "bulk-archive") {
      void doBulkArchive(pendingAction.domainIds);
    } else if (pendingAction.type === "bulk-delete") {
      void doBulkDelete(pendingAction.domainIds);
    }
    setPendingAction(null);
  }, [
    pendingAction,
    removeMutation,
    archiveMutation,
    doBulkArchive,
    doBulkDelete,
  ]);

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

  const handleRemove = useCallback((id: string, domainName: string) => {
    setPendingAction({ type: "remove", domainId: id, domainName });
  }, []);

  const handleArchive = useCallback((id: string, domainName: string) => {
    setPendingAction({ type: "archive", domainId: id, domainName });
  }, []);

  const handleBulkArchive = useCallback(() => {
    const domainIds = selection.selectedArray;
    if (domainIds.length === 0) return;
    setPendingAction({
      type: "bulk-archive",
      domainIds,
      count: domainIds.length,
    });
  }, [selection.selectedArray]);

  const handleBulkDelete = useCallback(() => {
    const domainIds = selection.selectedArray;
    if (domainIds.length === 0) return;
    setPendingAction({
      type: "bulk-delete",
      domainIds,
      count: domainIds.length,
    });
  }, [selection.selectedArray]);

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
          icon={IconHeartHandshake}
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
                <IconArchive />
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
            <IconArrowLeft />
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
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        {pendingAction && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {getConfirmDialogContent(pendingAction).title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {getConfirmDialogContent(pendingAction).description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                variant={getConfirmDialogContent(pendingAction).variant}
              >
                {getConfirmDialogContent(pendingAction).confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
