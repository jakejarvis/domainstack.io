"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AddDomainDialog } from "@/components/dashboard/add-domain-dialog";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TrackedDomainsView } from "@/components/dashboard/tracked-domains-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useViewPreference } from "@/hooks/use-view-preference";
import { useSession } from "@/lib/auth-client";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";

type ResumeDomainData = {
  id: string;
  domainName: string;
  verificationToken: string;
};

export default function DashboardPage() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [resumeDomain, setResumeDomain] = useState<ResumeDomainData | null>(
    null,
  );
  const [viewMode, setViewMode] = useViewPreference();
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const limitsQuery = useQuery(trpc.tracking.getLimits.queryOptions());
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions());

  // Get query keys for cache manipulation
  const limitsQueryKey = trpc.tracking.getLimits.queryKey();
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();

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
                currentCount: Math.max(0, old.currentCount - 1),
                canAddMore: old.currentCount - 1 < old.maxDomains,
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

  const handleRemove = useCallback(
    (id: string) => {
      removeMutation.mutate({ trackedDomainId: id });
    },
    [removeMutation],
  );

  const isLoading = limitsQuery.isLoading || domainsQuery.isLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const userName = session?.user?.name || "there";
  const trackedCount = limitsQuery.data?.currentCount ?? 0;
  const maxDomains = limitsQuery.data?.maxDomains ?? 5;
  const domains = domainsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <DashboardHeader
        userName={userName}
        trackedCount={trackedCount}
        maxDomains={maxDomains}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddDomain={handleAddDomain}
      />

      <TrackedDomainsView
        viewMode={viewMode}
        domains={domains}
        onAddDomain={handleAddDomain}
        onVerify={handleVerify}
        onRemove={handleRemove}
      />

      <AddDomainDialog
        open={addDialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleAddSuccess}
        resumeDomain={resumeDomain}
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
