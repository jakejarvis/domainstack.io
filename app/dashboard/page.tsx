"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Sparkles } from "lucide-react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AddDomainDialog,
  type ResumeDomainData,
} from "@/components/dashboard/add-domain/add-domain-dialog";
import { ArchivedDomainsView } from "@/components/dashboard/archived-domains-view";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DomainFilters } from "@/components/dashboard/domain-filters";
import { HealthSummary } from "@/components/dashboard/health-summary";
import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { TrackedDomainsView } from "@/components/dashboard/tracked-domains-view";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDomainFilters } from "@/hooks/use-domain-filters";
import { useRouter } from "@/hooks/use-router";
import { useSelection } from "@/hooks/use-selection";
import { sortDomains, useSortPreference } from "@/hooks/use-sort-preference";
import { useViewPreference } from "@/hooks/use-view-preference";
import { useSession } from "@/lib/auth-client";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";

type ConfirmAction =
  | { type: "remove"; domainId: string; domainName: string }
  | { type: "archive"; domainId: string; domainName: string }
  | { type: "bulk-archive"; domainIds: string[]; count: number }
  | { type: "bulk-delete"; domainIds: string[]; count: number };

function DashboardContent() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [resumeDomain, setResumeDomain] = useState<ResumeDomainData | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [viewMode, setViewMode] = useViewPreference();
  const [sortOption, setSortOption] = useSortPreference();
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const limitsQuery = useQuery(trpc.tracking.getLimits.queryOptions());
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions());
  const archivedDomainsQuery = useQuery(
    trpc.tracking.listArchivedDomains.queryOptions(),
  );

  // Filter domains
  const domains = domainsQuery.data ?? [];
  const {
    search,
    status,
    health,
    tlds,
    setSearch,
    setStatus,
    setHealth,
    setTlds,
    filteredDomains: filteredUnsorted,
    availableTlds,
    hasActiveFilters,
    clearFilters,
    applyHealthFilter,
    stats,
  } = useDomainFilters(domains);

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
  const selection = useSelection(filteredDomainIds);

  // Handle ?upgraded=true query param (after nuqs adapter)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      setShowUpgradedBanner(true);
      // Clear the query param from URL without triggering navigation
      router.replace("/dashboard", { scroll: false });
    }
  }, [router]);

  // Get query keys for cache manipulation
  const limitsQueryKey = trpc.tracking.getLimits.queryKey();
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const archivedDomainsQueryKey = trpc.tracking.listArchivedDomains.queryKey();

  // Remove mutation with optimistic updates
  const removeMutation = useMutation({
    ...trpc.tracking.removeDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: limitsQueryKey });

      // Snapshot the previous values
      const previousDomains = queryClient.getQueryData(domainsQueryKey);
      const previousLimits = queryClient.getQueryData(limitsQueryKey);

      // Optimistically update domains list
      queryClient.setQueryData(
        domainsQueryKey,
        (old: TrackedDomainWithDetails[] | undefined) =>
          old?.filter((d) => d.id !== trackedDomainId) ?? [],
      );

      // Optimistically update limits count
      queryClient.setQueryData(
        limitsQueryKey,
        (old: typeof limitsQuery.data) =>
          old
            ? {
                ...old,
                activeCount: Math.max(0, old.activeCount - 1),
                canAddMore: old.activeCount - 1 < old.maxDomains,
              }
            : old,
      );

      // Return snapshot for rollback
      return { previousDomains, previousLimits };
    },
    onError: (err, _variables, context) => {
      // Roll back to previous state on error
      if (context?.previousDomains) {
        queryClient.setQueryData(domainsQueryKey, context.previousDomains);
      }
      if (context?.previousLimits) {
        queryClient.setQueryData(limitsQueryKey, context.previousLimits);
      }
      logger.error("Failed to remove domain", err);
      toast.error("Failed to remove domain");
    },
    onSuccess: () => {
      toast.success("Domain removed");
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
      void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
    },
  });

  // Archive mutation with optimistic updates
  const archiveMutation = useMutation({
    ...trpc.tracking.archiveDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: archivedDomainsQueryKey });
      await queryClient.cancelQueries({ queryKey: limitsQueryKey });

      const previousDomains = queryClient.getQueryData(domainsQueryKey);
      const previousArchived = queryClient.getQueryData(
        archivedDomainsQueryKey,
      );
      const previousLimits = queryClient.getQueryData(limitsQueryKey);

      // Find the domain being archived
      const domainToArchive = (
        previousDomains as TrackedDomainWithDetails[] | undefined
      )?.find((d) => d.id === trackedDomainId);

      // Move from active to archived
      queryClient.setQueryData(
        domainsQueryKey,
        (old: TrackedDomainWithDetails[] | undefined) =>
          old?.filter((d) => d.id !== trackedDomainId) ?? [],
      );

      if (domainToArchive) {
        queryClient.setQueryData(
          archivedDomainsQueryKey,
          (old: TrackedDomainWithDetails[] | undefined) => [
            ...(old ?? []),
            { ...domainToArchive, archivedAt: new Date() },
          ],
        );
      }

      queryClient.setQueryData(
        limitsQueryKey,
        (old: typeof limitsQuery.data) =>
          old
            ? {
                ...old,
                activeCount: Math.max(0, old.activeCount - 1),
                archivedCount: old.archivedCount + 1,
                canAddMore: old.activeCount - 1 < old.maxDomains,
              }
            : old,
      );

      return { previousDomains, previousArchived, previousLimits };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDomains) {
        queryClient.setQueryData(domainsQueryKey, context.previousDomains);
      }
      if (context?.previousArchived) {
        queryClient.setQueryData(
          archivedDomainsQueryKey,
          context.previousArchived,
        );
      }
      if (context?.previousLimits) {
        queryClient.setQueryData(limitsQueryKey, context.previousLimits);
      }
      logger.error("Failed to archive domain", err);
      toast.error("Failed to archive domain");
    },
    onSuccess: () => {
      toast.success("Domain archived");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
      void queryClient.invalidateQueries({ queryKey: archivedDomainsQueryKey });
      void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
    },
  });

  // Unarchive mutation with optimistic updates
  const unarchiveMutation = useMutation({
    ...trpc.tracking.unarchiveDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: archivedDomainsQueryKey });
      await queryClient.cancelQueries({ queryKey: limitsQueryKey });

      const previousDomains = queryClient.getQueryData(domainsQueryKey);
      const previousArchived = queryClient.getQueryData(
        archivedDomainsQueryKey,
      );
      const previousLimits = queryClient.getQueryData(limitsQueryKey);

      // Find the domain being unarchived
      const domainToUnarchive = (
        previousArchived as TrackedDomainWithDetails[] | undefined
      )?.find((d) => d.id === trackedDomainId);

      // Move from archived to active
      queryClient.setQueryData(
        archivedDomainsQueryKey,
        (old: TrackedDomainWithDetails[] | undefined) =>
          old?.filter((d) => d.id !== trackedDomainId) ?? [],
      );

      if (domainToUnarchive) {
        queryClient.setQueryData(
          domainsQueryKey,
          (old: TrackedDomainWithDetails[] | undefined) => [
            ...(old ?? []),
            { ...domainToUnarchive, archivedAt: null },
          ],
        );
      }

      queryClient.setQueryData(
        limitsQueryKey,
        (old: typeof limitsQuery.data) =>
          old
            ? {
                ...old,
                activeCount: old.activeCount + 1,
                archivedCount: Math.max(0, old.archivedCount - 1),
                canAddMore: old.activeCount + 1 < old.maxDomains,
              }
            : old,
      );

      return { previousDomains, previousArchived, previousLimits };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDomains) {
        queryClient.setQueryData(domainsQueryKey, context.previousDomains);
      }
      if (context?.previousArchived) {
        queryClient.setQueryData(
          archivedDomainsQueryKey,
          context.previousArchived,
        );
      }
      if (context?.previousLimits) {
        queryClient.setQueryData(limitsQueryKey, context.previousLimits);
      }
      logger.error("Failed to unarchive domain", err);
      // Show server error message (e.g., "You've reached your domain limit")
      const message =
        err instanceof Error ? err.message : "Failed to reactivate domain";
      toast.error(message);
    },
    onSuccess: () => {
      toast.success("Domain reactivated");
      // Switch to Active tab so user can see the reactivated domain
      setActiveTab("active");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
      void queryClient.invalidateQueries({ queryKey: archivedDomainsQueryKey });
      void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
    },
  });

  const handleAddDomain = useCallback(() => {
    setResumeDomain(null); // Clear any resume state
    setAddDialogOpen(true);
  }, []);

  const handleAddSuccess = useCallback(() => {
    setResumeDomain(null);
    // Invalidate queries to refetch fresh data
    void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
  }, [queryClient, domainsQueryKey, limitsQueryKey]);

  const handleVerify = useCallback((domain: TrackedDomainWithDetails) => {
    // Open dialog in resume mode with the domain's verification info
    setResumeDomain({
      id: domain.id,
      domainName: domain.domainName,
      verificationToken: domain.verificationToken,
    });
    setAddDialogOpen(true);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setAddDialogOpen(open);
    if (!open) {
      setResumeDomain(null);
    }
  }, []);

  // Show confirmation dialog before removing
  const handleRemove = useCallback((id: string, domainName: string) => {
    setConfirmAction({ type: "remove", domainId: id, domainName });
  }, []);

  // Show confirmation dialog before archiving
  const handleArchive = useCallback((id: string, domainName: string) => {
    setConfirmAction({ type: "archive", domainId: id, domainName });
  }, []);

  // Bulk archive: show confirmation dialog
  const handleBulkArchive = useCallback(() => {
    const domainIds = selection.selectedArray;
    if (domainIds.length === 0) return;
    setConfirmAction({
      type: "bulk-archive",
      domainIds,
      count: domainIds.length,
    });
  }, [selection.selectedArray]);

  // Bulk delete: show confirmation dialog
  const handleBulkDelete = useCallback(() => {
    const domainIds = selection.selectedArray;
    if (domainIds.length === 0) return;
    setConfirmAction({
      type: "bulk-delete",
      domainIds,
      count: domainIds.length,
    });
  }, [selection.selectedArray]);

  // Execute bulk archive
  const executeBulkArchive = useCallback(
    async (domainIds: string[]) => {
      setIsBulkArchiving(true);
      let successCount = 0;
      let failCount = 0;

      for (const id of domainIds) {
        try {
          await archiveMutation.mutateAsync({ trackedDomainId: id });
          successCount++;
        } catch {
          failCount++;
        }
      }

      setIsBulkArchiving(false);
      selection.clearSelection();

      if (failCount === 0) {
        toast.success(
          `Archived ${successCount} domain${successCount === 1 ? "" : "s"}`,
        );
      } else {
        toast.warning(
          `Archived ${successCount} of ${domainIds.length} domains (${failCount} failed)`,
        );
      }
    },
    [archiveMutation, selection],
  );

  // Execute bulk delete
  const executeBulkDelete = useCallback(
    async (domainIds: string[]) => {
      setIsBulkDeleting(true);
      let successCount = 0;
      let failCount = 0;

      for (const id of domainIds) {
        try {
          await removeMutation.mutateAsync({ trackedDomainId: id });
          successCount++;
        } catch {
          failCount++;
        }
      }

      setIsBulkDeleting(false);
      selection.clearSelection();

      if (failCount === 0) {
        toast.success(
          `Deleted ${successCount} domain${successCount === 1 ? "" : "s"}`,
        );
      } else {
        toast.warning(
          `Deleted ${successCount} of ${domainIds.length} domains (${failCount} failed)`,
        );
      }
    },
    [removeMutation, selection],
  );

  // Execute the confirmed action
  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;

    if (confirmAction.type === "remove") {
      removeMutation.mutate({ trackedDomainId: confirmAction.domainId });
    } else if (confirmAction.type === "archive") {
      archiveMutation.mutate({ trackedDomainId: confirmAction.domainId });
    } else if (confirmAction.type === "bulk-archive") {
      void executeBulkArchive(confirmAction.domainIds);
    } else if (confirmAction.type === "bulk-delete") {
      void executeBulkDelete(confirmAction.domainIds);
    }

    setConfirmAction(null);
  }, [
    confirmAction,
    removeMutation,
    archiveMutation,
    executeBulkArchive,
    executeBulkDelete,
  ]);

  const handleUnarchive = useCallback(
    (id: string) => {
      unarchiveMutation.mutate({ trackedDomainId: id });
    },
    [unarchiveMutation],
  );

  // Get confirmation dialog content based on action type
  const getConfirmDialogContent = () => {
    if (!confirmAction) {
      return {
        title: "",
        description: "",
        confirmLabel: "",
        variant: "default" as const,
      };
    }

    switch (confirmAction.type) {
      case "remove":
        return {
          title: "Remove domain?",
          description: `Are you sure you want to remove "${confirmAction.domainName}"? This action cannot be undone and you will stop receiving notifications for this domain.`,
          confirmLabel: "Remove",
          variant: "destructive" as const,
        };
      case "archive":
        return {
          title: "Archive domain?",
          description: `Are you sure you want to archive "${confirmAction.domainName}"? You can reactivate it later from the Archived tab.`,
          confirmLabel: "Archive",
          variant: "default" as const,
        };
      case "bulk-archive":
        return {
          title: `Archive ${confirmAction.count} domains?`,
          description: `Are you sure you want to archive ${confirmAction.count} domain${confirmAction.count === 1 ? "" : "s"}? You can reactivate them later from the Archived tab.`,
          confirmLabel: "Archive All",
          variant: "default" as const,
        };
      case "bulk-delete":
        return {
          title: `Delete ${confirmAction.count} domains?`,
          description: `Are you sure you want to permanently delete ${confirmAction.count} domain${confirmAction.count === 1 ? "" : "s"}? This action cannot be undone and you will stop receiving notifications for these domains.`,
          confirmLabel: "Delete All",
          variant: "destructive" as const,
        };
    }
  };

  const confirmDialogContent = getConfirmDialogContent();

  const isLoading =
    limitsQuery.isLoading ||
    domainsQuery.isLoading ||
    archivedDomainsQuery.isLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const userName = session?.user?.name || "there";
  const activeCount = limitsQuery.data?.activeCount ?? 0;
  const archivedCount = limitsQuery.data?.archivedCount ?? 0;
  const maxDomains = limitsQuery.data?.maxDomains ?? 5;
  const tier = limitsQuery.data?.tier ?? "free";
  const canAddMore = limitsQuery.data?.canAddMore ?? true;
  const subscriptionEndsAt = limitsQuery.data?.subscriptionEndsAt ?? null;
  const archivedDomains = archivedDomainsQuery.data ?? [];

  return (
    <div className="space-y-6 pb-24">
      <DashboardHeader
        userName={userName}
        trackedCount={activeCount}
        maxDomains={maxDomains}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddDomain={handleAddDomain}
      />

      {/* Pro upgrade success banner */}
      {showUpgradedBanner && (
        <DashboardBanner
          variant="success"
          icon={Sparkles}
          title="Welcome to Pro!"
          description="You now have access to track up to 50 domains. Thank you for upgrading!"
          dismissible
          onDismiss={() => setShowUpgradedBanner(false)}
        />
      )}

      {/* Subscription ending banner for users who canceled */}
      {subscriptionEndsAt && (
        <SubscriptionEndingBanner subscriptionEndsAt={subscriptionEndsAt} />
      )}

      {/* Upgrade prompt when near limit */}
      <UpgradePrompt
        currentCount={activeCount}
        maxDomains={maxDomains}
        tier={tier}
      />

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
            <DomainFilters
              search={search}
              status={status}
              health={health}
              tlds={tlds}
              availableTlds={availableTlds}
              onSearchChange={setSearch}
              onStatusChange={setStatus}
              onHealthChange={setHealth}
              onTldsChange={setTlds}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              viewMode={viewMode}
              sortOption={sortOption}
              onSortChange={setSortOption}
            />
          )}

          <TrackedDomainsView
            viewMode={viewMode}
            domains={filteredDomains}
            totalDomains={domains.length}
            hasActiveFilters={hasActiveFilters}
            selection={selection}
            onAddDomain={handleAddDomain}
            onVerify={handleVerify}
            onRemove={(id, domainName) => handleRemove(id, domainName)}
            onArchive={(id, domainName) => handleArchive(id, domainName)}
            onClearFilters={clearFilters}
            onBulkArchive={handleBulkArchive}
            onBulkDelete={handleBulkDelete}
            isBulkArchiving={isBulkArchiving}
            isBulkDeleting={isBulkDeleting}
          />

          {/* Link to archived domains - only show when there are archived domains */}
          {archivedCount > 0 && (
            <div className="pt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setActiveTab("archived")}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <Archive className="size-4" />
                View {archivedCount} archived domain{archivedCount !== 1 && "s"}
              </Button>
            </div>
          )}
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
            <ArrowLeft className="size-4" />
            Back to domains
          </Button>

          <ArchivedDomainsView
            domains={archivedDomains}
            onUnarchive={handleUnarchive}
            onRemove={(id, domainName) => handleRemove(id, domainName)}
            canUnarchive={canAddMore}
            tier={tier}
          />
        </div>
      )}

      <AddDomainDialog
        open={addDialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleAddSuccess}
        resumeDomain={resumeDomain}
      />

      {/* Confirmation dialog for destructive actions */}
      <ConfirmActionDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={confirmDialogContent.title}
        description={confirmDialogContent.description}
        confirmLabel={confirmDialogContent.confirmLabel}
        onConfirm={handleConfirmAction}
        variant={confirmDialogContent.variant}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <NuqsAdapter>
      <DashboardContent />
    </NuqsAdapter>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-2 w-32 rounded-full" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Health summary skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-56" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
