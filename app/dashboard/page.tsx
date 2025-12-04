"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AddDomainDialog } from "@/components/dashboard/add-domain-dialog";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TrackedDomainsView } from "@/components/dashboard/tracked-domains-view";
import { Skeleton } from "@/components/ui/skeleton";
import { useViewPreference } from "@/hooks/use-view-preference";
import { useSession } from "@/lib/auth-client";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
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

  const limitsQuery = useQuery(trpc.tracking.getLimits.queryOptions());
  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions());
  const removeMutation = useMutation(
    trpc.tracking.removeDomain.mutationOptions(),
  );

  const handleAddDomain = useCallback(() => {
    setResumeDomain(null); // Clear any resume state
    setAddDialogOpen(true);
  }, []);

  const handleAddSuccess = useCallback(() => {
    setResumeDomain(null);
    limitsQuery.refetch();
    domainsQuery.refetch();
  }, [limitsQuery, domainsQuery]);

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
    async (id: string) => {
      try {
        await removeMutation.mutateAsync({ trackedDomainId: id });
        toast.success("Domain removed");
        limitsQuery.refetch();
        domainsQuery.refetch();
      } catch {
        toast.error("Failed to remove domain");
      }
    },
    [removeMutation, limitsQuery, domainsQuery],
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
