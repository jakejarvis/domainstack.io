"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Globe, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AddDomainDialog,
  type ResumeDomainData,
} from "@/components/dashboard/add-domain/add-domain-dialog";
import { ArchivedDomainsView } from "@/components/dashboard/archived-domains-view";
import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { DashboardBanner } from "@/components/dashboard/dashboard-banner";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { TrackedDomainsView } from "@/components/dashboard/tracked-domains-view";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/hooks/use-router";
import { useViewPreference } from "@/hooks/use-view-preference";
import { useSession } from "@/lib/auth-client";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";

type ConfirmAction = {
  type: "remove" | "archive";
  domainId: string;
  domainName: string;
};

export default function DashboardPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [resumeDomain, setResumeDomain] = useState<ResumeDomainData | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);
  const [viewMode, setViewMode] = useViewPreference();
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle ?upgraded=true query param
  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      setShowUpgradedBanner(true);
      // Clear the query param from URL without triggering navigation
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, router]);

  const limitsQuery = useQuery(trpc.tracking.getLimits.queryOptions());
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions());
  const archivedDomainsQuery = useQuery(
    trpc.tracking.listArchivedDomains.queryOptions(),
  );

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
      toast.error("Failed to unarchive domain");
    },
    onSuccess: () => {
      toast.success("Domain reactivated");
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

  // Execute the confirmed action
  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;

    if (confirmAction.type === "remove") {
      removeMutation.mutate({ trackedDomainId: confirmAction.domainId });
    } else if (confirmAction.type === "archive") {
      archiveMutation.mutate({ trackedDomainId: confirmAction.domainId });
    }

    setConfirmAction(null);
  }, [confirmAction, removeMutation, archiveMutation]);

  const handleUnarchive = useCallback(
    (id: string) => {
      unarchiveMutation.mutate({ trackedDomainId: id });
    },
    [unarchiveMutation],
  );

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
  const domains = domainsQuery.data ?? [];
  const archivedDomains = archivedDomainsQuery.data ?? [];

  return (
    <div className="space-y-8">
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

      {/* Tabs for Active/Archived domains */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="active" className="gap-2">
            <Globe className="size-4" />
            Active
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="size-4" />
            Archived
            {archivedCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {archivedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <TrackedDomainsView
            viewMode={viewMode}
            domains={domains}
            onAddDomain={handleAddDomain}
            onVerify={handleVerify}
            onRemove={(id, domainName) => handleRemove(id, domainName)}
            onArchive={(id, domainName) => handleArchive(id, domainName)}
          />
        </TabsContent>

        <TabsContent value="archived">
          <ArchivedDomainsView
            domains={archivedDomains}
            onUnarchive={handleUnarchive}
            onRemove={(id, domainName) => handleRemove(id, domainName)}
            canUnarchive={canAddMore}
            tier={tier}
          />
        </TabsContent>
      </Tabs>

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
        title={
          confirmAction?.type === "remove"
            ? "Remove domain?"
            : "Archive domain?"
        }
        description={
          confirmAction?.type === "remove"
            ? `Are you sure you want to remove "${confirmAction?.domainName}"? This action cannot be undone and you will stop receiving notifications for this domain.`
            : `Are you sure you want to archive "${confirmAction?.domainName}"? You can reactivate it later from the Archived tab.`
        }
        confirmLabel={confirmAction?.type === "remove" ? "Remove" : "Archive"}
        onConfirm={handleConfirmAction}
        variant={confirmAction?.type === "remove" ? "destructive" : "default"}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
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

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
