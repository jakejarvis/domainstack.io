"use client";

import type { Table } from "@tanstack/react-table";
import { Archive, ArrowLeft, HeartHandshake } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArchivedDomainsView } from "@/components/dashboard/archived-domains-view";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DomainFilters } from "@/components/dashboard/domain-filters";
import { HealthSummary } from "@/components/dashboard/health-summary";
import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { TrackedDomainsView } from "@/components/dashboard/tracked-domains-view";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
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
import { useViewPreference } from "@/hooks/use-dashboard-preferences";
import { sortDomains, useGridSortPreference } from "@/hooks/use-dashboard-sort";
import { useDomainMutations } from "@/hooks/use-domain-mutations";
import { useRouter } from "@/hooks/use-router";
import { useSelection } from "@/hooks/use-selection";
import { useSubscription } from "@/hooks/use-subscription";
import { useTrackedDomains } from "@/hooks/use-tracked-domains";
import { useSession } from "@/lib/auth-client";
import { DEFAULT_TIER_LIMITS } from "@/lib/constants";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { cn } from "@/lib/utils";

type ConfirmAction =
  | { type: "remove"; domainId: string; domainName: string }
  | { type: "archive"; domainId: string; domainName: string }
  | { type: "bulk-archive"; domainIds: string[]; count: number }
  | { type: "bulk-delete"; domainIds: string[]; count: number };

export function DashboardContent() {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [viewMode, setViewMode] = useViewPreference();
  const [sortOption, setSortOption] = useGridSortPreference();
  const [tableInstance, setTableInstance] =
    useState<Table<TrackedDomainWithDetails> | null>(null);
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();

  const {
    subscription,
    isLoading: subscriptionLoading,
    isError: subscriptionError,
    refetch: refetchSubscription,
  } = useSubscription();
  const {
    domains: allDomains,
    isLoading: domainsLoading,
    isError: domainsError,
    refetch: refetchDomains,
  } = useTrackedDomains({ includeArchived: true });

  // Domain mutations with optimistic updates
  const {
    removeMutation,
    archiveMutation,
    unarchiveMutation,
    bulkArchiveMutation,
    bulkDeleteMutation,
  } = useDomainMutations({
    onUnarchiveSuccess: () => setActiveTab("active"),
  });

  const domains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt === null) ?? [],
    [allDomains],
  );
  const archivedDomains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt !== null) ?? [],
    [allDomains],
  );
  const totalDomainsCount = domains.length;
  const {
    search,
    status,
    health,
    tlds,
    providers,
    setSearch,
    setStatus,
    setHealth,
    setTlds,
    setProviders,
    filteredDomains: filteredUnsorted,
    availableTlds,
    availableProviders,
    hasActiveFilters,
    clearFilters,
    applyHealthFilter,
    stats,
  } = useDashboardFilters(domains);

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
  const searchParams = useSearchParams();

  // Handle ?upgraded=true query param (after nuqs adapter)
  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
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
      // Navigate to add-domain with resume params
      // Only ID is strictly required for resumption;
      // other params can be helpful hints but should be validated/fetched server-side
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
          description: `Are you sure you want to stop tracking ${confirmAction.domainName}?`,
          confirmLabel: "Remove",
          variant: "destructive" as const,
        };
      case "archive":
        return {
          title: "Archive domain?",
          description: `Are you sure you want to archive ${confirmAction.domainName}? You can reactivate it later from the Archived section.`,
          confirmLabel: "Archive",
          variant: "default" as const,
        };
      case "bulk-archive":
        return {
          title: `Archive ${confirmAction.count} domains?`,
          description: `Are you sure you want to archive ${confirmAction.count} domain${confirmAction.count === 1 ? "" : "s"}? You can reactivate them later from the Archived section.`,
          confirmLabel: "Archive All",
          variant: "default" as const,
        };
      case "bulk-delete":
        return {
          title: `Delete ${confirmAction.count} domains?`,
          description: `Are you sure you want to stop tracking ${confirmAction.count} domain${confirmAction.count === 1 ? "" : "s"}?`,
          confirmLabel: "Delete All",
          variant: "destructive" as const,
        };
    }
  };

  const confirmDialogContent = getConfirmDialogContent();

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

  const userName = session?.user?.name || "";
  const activeCount = subscription?.activeCount ?? 0;
  const archivedCount = subscription?.archivedCount ?? 0;
  const maxDomains = subscription?.maxDomains ?? DEFAULT_TIER_LIMITS.free;
  const proMaxDomains = subscription?.proMaxDomains ?? DEFAULT_TIER_LIMITS.pro;
  const tier = subscription?.tier ?? "free";
  const canAddMore = subscription?.canAddMore ?? true;
  const subscriptionEndsAt = subscription?.subscriptionEndsAt ?? null;
  const hasAnyDomains = activeCount > 0 || archivedCount > 0;

  return (
    <div className="space-y-6">
      <DashboardHeader
        userName={userName}
        trackedCount={activeCount}
        maxDomains={maxDomains}
        viewMode={viewMode}
        tier={tier}
        subscriptionEndsAt={subscriptionEndsAt}
        onViewModeChange={setViewMode}
        hasAnyDomains={hasAnyDomains}
      />

      {/* Pro upgrade success banner */}
      {showUpgradedBanner && (
        <DashboardBanner
          variant="gold"
          icon={HeartHandshake}
          title="Welcome to Pro!"
          description={`You now have access to track up to ${proMaxDomains} domains. Thank you for upgrading!`}
          dismissible
          onDismiss={() => setShowUpgradedBanner(false)}
        />
      )}

      {/* Subscription ending banner for users who canceled */}
      <SubscriptionEndingBanner />

      {/* Upgrade prompt when near limit */}
      <UpgradePrompt />

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
              viewMode={viewMode}
              sortOption={sortOption}
              onSortChange={setSortOption}
              table={viewMode === "table" ? tableInstance : null}
            />
          )}

          <TrackedDomainsView
            viewMode={viewMode}
            domains={filteredDomains}
            totalDomains={totalDomainsCount}
            hasActiveFilters={hasActiveFilters}
            selection={selection}
            tier={tier}
            proMaxDomains={proMaxDomains}
            onAddDomain={handleAddDomain}
            onVerify={handleVerify}
            onRemove={handleRemove}
            onArchive={handleArchive}
            onBulkArchive={handleBulkArchive}
            onBulkDelete={handleBulkDelete}
            onTableReady={setTableInstance}
            onClearFilters={clearFilters}
            isBulkArchiving={isBulkArchiving}
            isBulkDeleting={isBulkDeleting}
          />

          {/* Link to archived domains - only show when there are archived domains */}
          {archivedCount > 0 && (
            <div className="pt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setActiveTab("archived")}
                className="cursor-pointer gap-2 text-muted-foreground hover:text-foreground"
              >
                <Archive />
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
            className="cursor-pointer gap-2 text-muted-foreground hover:text-foreground"
            type="button"
          >
            <ArrowLeft />
            Back to domains
          </Button>

          <ArchivedDomainsView
            domains={archivedDomains}
            onUnarchive={handleUnarchive}
            onRemove={handleRemove}
            canUnarchive={canAddMore}
            tier={tier}
          />
        </div>
      )}

      {/* Confirmation dialog for destructive actions */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={cn(
                confirmDialogContent.variant === "destructive" &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                "cursor-pointer disabled:cursor-not-allowed",
              )}
            >
              {confirmDialogContent.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
