"use client";

import type { VerificationMethod } from "@domainstack/constants";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@domainstack/ui/alert-dialog";
import { Button } from "@domainstack/ui/button";
import {
  IconArchive,
  IconArrowLeft,
  IconHeartHandshake,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { Table } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DashboardProvider } from "@/context/dashboard-context";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import { useDashboardPagination } from "@/hooks/use-dashboard-pagination";
import {
  useDashboardSelection,
  useSyncVisibleDomainIds,
} from "@/hooks/use-dashboard-selection";
import { useRouter } from "@/hooks/use-router";
import { useSubscription } from "@/hooks/use-subscription";
import { useSession } from "@/lib/auth-client";
import {
  type ConfirmAction,
  DEFAULT_SORT,
  getConfirmDialogContent,
  SORT_OPTIONS,
  type SortOption,
  sortDomains,
} from "@/lib/dashboard-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { useTRPC } from "@/lib/trpc/client";

export function DashboardClient() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const trpc = useTRPC();
  const {
    subscription,
    isSubscriptionLoading: subscriptionLoading,
    isSubscriptionError: subscriptionError,
    refetchSubscription,
  } = useSubscription();
  const mutations = useDashboardMutations();

  const [activeTab, setActiveTab] = useQueryState(
    "view",
    parseAsStringLiteral(["active", "archived"])
      .withDefault("active")
      .withOptions({ shallow: true, clearOnDefault: true }),
  );
  const viewMode = usePreferencesStore((s) => s.viewMode);

  // Grid sort state with URL persistence
  const [sortParam, setSortParam] = useQueryState(
    "sort",
    parseAsString.withDefault(DEFAULT_SORT).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );
  const sortOption = SORT_OPTIONS.some((opt) => opt.value === sortParam)
    ? (sortParam as SortOption)
    : DEFAULT_SORT;
  const setSortOption = setSortParam;

  // Pagination state
  const {
    state: pagination,
    actions: { setPageIndex, setPageSize, resetPage },
  } = useDashboardPagination();

  const [tableInstance, setTableInstance] =
    useState<Table<TrackedDomainWithDetails> | null>(null);

  // Tracked domains query
  const domainsQuery = useQuery(
    trpc.tracking.listDomains.queryOptions({ includeArchived: true }),
  );
  const allDomains = domainsQuery.data;

  const domains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt === null) ?? [],
    [allDomains],
  );
  const archivedDomains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt !== null) ?? [],
    [allDomains],
  );

  // -------------------------------------------------------------------------
  // Filter State
  // -------------------------------------------------------------------------

  const { state: filterHookState, actions: filterHookActions } =
    useDashboardFilters(domains);

  // Destructure for easier access
  const {
    search,
    status,
    health,
    tlds,
    providers,
    domainId,
    filteredDomainName,
    availableTlds,
    availableProviders,
    hasActiveFilters,
    stats,
    filteredDomains: filteredUnsorted,
  } = filterHookState;

  const {
    setSearch,
    setStatus,
    setHealth,
    setTlds,
    setProviders,
    clearFilters,
    applyHealthFilter,
    clearDomainId,
  } = filterHookActions;

  // Apply sorting after filtering (only for grid view - table has its own column sorting)
  const filteredDomains = useMemo(
    () =>
      viewMode === "grid"
        ? sortDomains(filteredUnsorted, sortOption)
        : filteredUnsorted,
    [filteredUnsorted, sortOption, viewMode],
  );

  // Filtered domain IDs for selection - sync to Jotai atom
  const filteredDomainIds = useMemo(
    () => filteredDomains.map((d) => d.id),
    [filteredDomains],
  );
  useSyncVisibleDomainIds(filteredDomainIds);

  // Selection state from Jotai
  const { clearSelection } = useDashboardSelection();

  const doBulkArchive = useCallback(
    async (domainIds: string[]) => {
      try {
        const result = await mutations.bulkArchive(domainIds);
        clearSelection();
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
    [mutations, clearSelection],
  );

  const doBulkDelete = useCallback(
    async (domainIds: string[]) => {
      try {
        const result = await mutations.bulkDelete(domainIds);
        clearSelection();
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
    [mutations, clearSelection],
  );

  // Confirmation dialog - local state
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(
    null,
  );

  // Upgrade banner - local state
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;
    if (pendingAction.type === "remove") {
      mutations.remove(pendingAction.domainId);
    } else if (pendingAction.type === "archive") {
      mutations.archive(pendingAction.domainId);
    } else if (pendingAction.type === "bulk-archive") {
      void doBulkArchive(pendingAction.domainIds);
    } else if (pendingAction.type === "bulk-delete") {
      void doBulkDelete(pendingAction.domainIds);
    }
    setPendingAction(null);
  }, [pendingAction, mutations, doBulkArchive, doBulkDelete]);

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
    (id: string, verificationMethod: VerificationMethod | null) => {
      const params = new URLSearchParams({
        resume: "true",
        id,
      });

      if (verificationMethod) {
        params.set("method", verificationMethod);
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

  // Bulk action handlers - receive domainIds from context
  const handleBulkArchive = useCallback((domainIds: string[]) => {
    if (domainIds.length === 0) return;
    setPendingAction({
      type: "bulk-archive",
      domainIds,
      count: domainIds.length,
    });
  }, []);

  const handleBulkDelete = useCallback((domainIds: string[]) => {
    if (domainIds.length === 0) return;
    setPendingAction({
      type: "bulk-delete",
      domainIds,
      count: domainIds.length,
    });
  }, []);

  const handleUnarchive = useCallback(
    (id: string) => {
      mutations.unarchive(id);
    },
    [mutations],
  );

  const handleToggleMuted = useCallback(
    (id: string, muted: boolean) => {
      mutations.setMuted(id, muted);
    },
    [mutations],
  );

  // Show loading until we have both query data AND session data
  const isLoading =
    subscriptionLoading || domainsQuery.isLoading || sessionLoading || !session;

  const hasError = subscriptionError || domainsQuery.isError;

  const handleRetry = useCallback(() => {
    refetchSubscription();
    domainsQuery.refetch();
  }, [refetchSubscription, domainsQuery]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (hasError) {
    return <DashboardError onRetry={handleRetry} />;
  }

  // Build filter state/actions for context
  const filterState = {
    search,
    status,
    health,
    tlds,
    providers,
    domainId,
    filteredDomainName,
    availableTlds,
    availableProviders,
    hasActiveFilters,
    stats,
    sortOption,
    table: viewMode === "table" ? tableInstance : null,
  };

  const filterActions = {
    setSearch,
    setStatus,
    setHealth,
    setTlds,
    setProviders,
    clearFilters,
    applyHealthFilter,
    clearDomainId,
    setSortOption,
    setTable: setTableInstance,
  };

  return (
    <div className="space-y-6">
      <DashboardHeader userName={session?.user?.name ?? ""} />

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

      <DashboardProvider
        onVerify={handleVerify}
        onRemove={handleRemove}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onToggleMuted={handleToggleMuted}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
        isBulkArchiving={mutations.isBulkArchiving}
        isBulkDeleting={mutations.isBulkDeleting}
        filterState={filterState}
        filterActions={filterActions}
        paginationState={pagination}
        paginationActions={{ setPageIndex, setPageSize, resetPage }}
      >
        {/* Active domains view */}
        {activeTab === "active" && (
          <div className="space-y-4">
            {/* Health summary - only show when there are domains */}
            {domains.length > 0 && <HealthSummary />}

            {/* Filters - only show when there are domains */}
            {domains.length > 0 && <DashboardFilters />}

            <DashboardContent
              domains={filteredDomains}
              totalDomains={domains.length}
              onAddDomain={handleAddDomain}
              onTableReady={setTableInstance}
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

            <ArchivedDomainsList domains={archivedDomains} />
          </div>
        )}
      </DashboardProvider>

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
