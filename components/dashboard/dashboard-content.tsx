"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AddDomainDialog,
  type ResumeDomainData,
} from "@/components/dashboard/add-domain/add-domain-dialog";
import { ArchivedDomainsView } from "@/components/dashboard/archived-domains-view";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { DashboardError } from "@/components/dashboard/dashboard-error";
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
import { DEFAULT_TIER_LIMITS } from "@/lib/constants";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";

type ConfirmAction =
  | { type: "remove"; domainId: string; domainName: string }
  | { type: "archive"; domainId: string; domainName: string }
  | { type: "bulk-archive"; domainIds: string[]; count: number }
  | { type: "bulk-delete"; domainIds: string[]; count: number };

export function DashboardContent() {
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

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: trpc.tracking.bulkArchiveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: archivedDomainsQueryKey });
      await queryClient.cancelQueries({ queryKey: limitsQueryKey });

      const previousDomains = queryClient.getQueryData(domainsQueryKey);
      const previousArchived = queryClient.getQueryData(
        archivedDomainsQueryKey,
      );
      const previousLimits = queryClient.getQueryData(limitsQueryKey);

      const idsSet = new Set(trackedDomainIds);
      const domainsToArchive = (
        previousDomains as TrackedDomainWithDetails[] | undefined
      )?.filter((d) => idsSet.has(d.id));
      // Use actual count of domains found in cache for consistent optimistic updates
      const archiveDelta = domainsToArchive?.length ?? 0;

      // Move from active to archived
      queryClient.setQueryData(
        domainsQueryKey,
        (old: TrackedDomainWithDetails[] | undefined) =>
          old?.filter((d) => !idsSet.has(d.id)) ?? [],
      );

      if (domainsToArchive) {
        queryClient.setQueryData(
          archivedDomainsQueryKey,
          (old: TrackedDomainWithDetails[] | undefined) => [
            ...(old ?? []),
            ...domainsToArchive.map((d) => ({ ...d, archivedAt: new Date() })),
          ],
        );
      }

      queryClient.setQueryData(
        limitsQueryKey,
        (old: typeof limitsQuery.data) =>
          old
            ? {
                ...old,
                activeCount: Math.max(0, old.activeCount - archiveDelta),
                archivedCount: old.archivedCount + archiveDelta,
                canAddMore: true,
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
      logger.error("Failed to bulk archive domains", err);
      toast.error("Failed to archive domains");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
      void queryClient.invalidateQueries({ queryKey: archivedDomainsQueryKey });
      void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: trpc.tracking.bulkRemoveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: limitsQueryKey });

      const previousDomains = queryClient.getQueryData(domainsQueryKey);
      const previousLimits = queryClient.getQueryData(limitsQueryKey);

      const idsSet = new Set(trackedDomainIds);
      // Use actual count of domains found in cache for consistent optimistic updates
      const domainsToDelete = (
        previousDomains as TrackedDomainWithDetails[] | undefined
      )?.filter((d) => idsSet.has(d.id));
      const deleteDelta = domainsToDelete?.length ?? 0;

      queryClient.setQueryData(
        domainsQueryKey,
        (old: TrackedDomainWithDetails[] | undefined) =>
          old?.filter((d) => !idsSet.has(d.id)) ?? [],
      );

      queryClient.setQueryData(
        limitsQueryKey,
        (old: typeof limitsQuery.data) =>
          old
            ? {
                ...old,
                activeCount: Math.max(0, old.activeCount - deleteDelta),
                canAddMore: true,
              }
            : old,
      );

      return { previousDomains, previousLimits };
    },
    onError: (err, _variables, context) => {
      if (context?.previousDomains) {
        queryClient.setQueryData(domainsQueryKey, context.previousDomains);
      }
      if (context?.previousLimits) {
        queryClient.setQueryData(limitsQueryKey, context.previousLimits);
      }
      logger.error("Failed to bulk delete domains", err);
      toast.error("Failed to delete domains");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
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
      } finally {
        setIsBulkArchiving(false);
      }
    },
    [bulkArchiveMutation, selection],
  );

  // Execute bulk delete
  const executeBulkDelete = useCallback(
    async (domainIds: string[]) => {
      setIsBulkDeleting(true);
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
      } finally {
        setIsBulkDeleting(false);
      }
    },
    [bulkDeleteMutation, selection],
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

  const hasError =
    limitsQuery.isError || domainsQuery.isError || archivedDomainsQuery.isError;

  const handleRetry = useCallback(() => {
    if (limitsQuery.isError) void limitsQuery.refetch();
    if (domainsQuery.isError) void domainsQuery.refetch();
    if (archivedDomainsQuery.isError) void archivedDomainsQuery.refetch();
  }, [limitsQuery, domainsQuery, archivedDomainsQuery]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (hasError) {
    return <DashboardError onRetry={handleRetry} />;
  }

  const userName = session?.user?.name || "there";
  const activeCount = limitsQuery.data?.activeCount ?? 0;
  const archivedCount = limitsQuery.data?.archivedCount ?? 0;
  const maxDomains = limitsQuery.data?.maxDomains ?? DEFAULT_TIER_LIMITS.free;
  const proMaxDomains =
    limitsQuery.data?.proMaxDomains ?? DEFAULT_TIER_LIMITS.pro;
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
        tier={tier}
        subscriptionEndsAt={subscriptionEndsAt}
        onViewModeChange={setViewMode}
        onAddDomain={handleAddDomain}
      />

      {/* Pro upgrade success banner */}
      {showUpgradedBanner && (
        <DashboardBanner
          variant="success"
          icon={Sparkles}
          title="Welcome to Pro!"
          description={`You now have access to track up to ${proMaxDomains} domains. Thank you for upgrading!`}
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
        proMaxDomains={proMaxDomains}
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
            tier={tier}
            proMaxDomains={proMaxDomains}
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

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-24">
      {/* Header skeleton - matches DashboardHeader */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-12 rounded-md" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Progress bar + count */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-2 w-24 rounded-full md:w-32" />
            <Skeleton className="h-4 w-8" />
          </div>
          {/* View toggle buttons */}
          <Skeleton className="h-9 w-[84px] rounded-md" />
          {/* Add Domain button */}
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Health summary skeleton - optional badges */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-8 w-44 rounded-full" />
      </div>

      {/* Filters skeleton */}
      <div className="space-y-3">
        {/* Mobile: collapsible button */}
        <Skeleton className="h-10 w-full rounded-md md:hidden" />
        {/* Desktop: full filter row */}
        <div className="hidden md:flex md:flex-wrap md:items-center md:gap-3">
          {/* Search input */}
          <Skeleton className="h-10 w-48 rounded-md lg:w-64" />
          {/* Filter dropdowns */}
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          {/* Sort dropdown */}
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Domain cards grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <DomainCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for a single domain card matching TrackedDomainCard layout.
 */
function DomainCardSkeleton() {
  return (
    <div className="rounded-xl border border-black/15 bg-background/60 p-6 dark:border-white/15">
      {/* Header: favicon + domain name + dropdown */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
        <Skeleton className="size-8 rounded" />
      </div>
      {/* Info rows */}
      <div className="mt-4 space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
