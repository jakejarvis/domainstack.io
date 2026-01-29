import type { TrackedDomainWithDetails } from "@domainstack/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulkMutationResult {
  successCount: number;
  failedCount: number;
}

type DomainsData = TrackedDomainWithDetails[] | undefined;

interface SubscriptionData {
  plan: "free" | "pro";
  planQuota: number;
  endsAt: Date | null;
  activeCount: number;
  archivedCount: number;
  canAddMore: boolean;
}

interface MutationContext {
  previousDomains: [unknown, unknown][];
  previousSubscription: SubscriptionData | undefined;
}

interface UseDashboardMutationsReturn {
  // Single-item mutations
  remove: (trackedDomainId: string) => void;
  archive: (trackedDomainId: string) => void;
  unarchive: (trackedDomainId: string) => void;
  setMuted: (trackedDomainId: string, muted: boolean) => void;

  // Bulk mutations (return promises for confirmation dialog flow)
  bulkArchive: (trackedDomainIds: string[]) => Promise<BulkMutationResult>;
  bulkDelete: (trackedDomainIds: string[]) => Promise<BulkMutationResult>;

  // Loading states
  isRemoving: boolean;
  isArchiving: boolean;
  isUnarchiving: boolean;
  isMuting: boolean;
  isBulkArchiving: boolean;
  isBulkDeleting: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Encapsulates all dashboard domain mutations with optimistic updates.
 *
 * All mutations handle:
 * - Optimistic cache updates for instant UI feedback
 * - Rollback on error
 * - Toast notifications for success/failure
 * - Query invalidation on settle
 */
export function useDashboardMutations(): UseDashboardMutationsReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const subscriptionQueryKey = trpc.user.getSubscription.queryKey();

  const invalidateDomainQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    void queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
  }, [queryClient, domainsQueryKey, subscriptionQueryKey]);

  // Helper to rollback domain queries
  const rollbackDomains = (previousDomains: [unknown, unknown][]) => {
    for (const [key, data] of previousDomains) {
      queryClient.setQueryData(key as string[], data);
    }
  };

  // ---------------------------------------------------------------------------
  // Remove Mutation
  // ---------------------------------------------------------------------------

  const removeMutation = useMutation({
    mutationFn: trpc.tracking.removeDomain.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: DomainsData) => old?.filter((d) => d.id !== trackedDomainId),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(
        subscriptionQueryKey,
        (old) => {
          if (!old) return old;
          const newActiveCount = Math.max(0, old.activeCount - 1);
          return {
            ...old,
            activeCount: newActiveCount,
            canAddMore: newActiveCount < old.planQuota,
          };
        },
      );

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (_err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) {
        rollbackDomains(context.previousDomains);
      }
      if (context?.previousSubscription) {
        queryClient.setQueryData(
          subscriptionQueryKey,
          context.previousSubscription,
        );
      }
      toast.error("Failed to remove domain");
    },
    onSuccess: () => toast.success("Domain removed"),
    onSettled: invalidateDomainQueries,
  });

  // ---------------------------------------------------------------------------
  // Archive Mutation
  // ---------------------------------------------------------------------------

  const archiveMutation = useMutation({
    mutationFn: trpc.tracking.archiveDomain.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: DomainsData) =>
          old?.map((d) =>
            d.id === trackedDomainId ? { ...d, archivedAt: new Date() } : d,
          ),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(
        subscriptionQueryKey,
        (old) => {
          if (!old) return old;
          const newActiveCount = Math.max(0, old.activeCount - 1);
          return {
            ...old,
            activeCount: newActiveCount,
            archivedCount: old.archivedCount + 1,
            canAddMore: newActiveCount < old.planQuota,
          };
        },
      );

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (_err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) {
        rollbackDomains(context.previousDomains);
      }
      if (context?.previousSubscription) {
        queryClient.setQueryData(
          subscriptionQueryKey,
          context.previousSubscription,
        );
      }
      toast.error("Failed to archive domain");
    },
    onSuccess: () => toast.success("Domain archived"),
    onSettled: invalidateDomainQueries,
  });

  // ---------------------------------------------------------------------------
  // Unarchive Mutation
  // ---------------------------------------------------------------------------

  const unarchiveMutation = useMutation({
    mutationFn: trpc.tracking.unarchiveDomain.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: DomainsData) =>
          old?.map((d) =>
            d.id === trackedDomainId ? { ...d, archivedAt: null } : d,
          ),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(
        subscriptionQueryKey,
        (old) => {
          if (!old) return old;
          const newActiveCount = old.activeCount + 1;
          return {
            ...old,
            activeCount: newActiveCount,
            archivedCount: Math.max(0, old.archivedCount - 1),
            canAddMore: newActiveCount < old.planQuota,
          };
        },
      );

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) {
        rollbackDomains(context.previousDomains);
      }
      if (context?.previousSubscription) {
        queryClient.setQueryData(
          subscriptionQueryKey,
          context.previousSubscription,
        );
      }
      toast.error(
        err instanceof Error ? err.message : "Failed to reactivate domain",
      );
    },
    onSuccess: () => toast.success("Domain reactivated"),
    onSettled: invalidateDomainQueries,
  });

  // ---------------------------------------------------------------------------
  // Mute Mutation
  // ---------------------------------------------------------------------------

  const muteMutation = useMutation({
    mutationFn: trpc.user.setDomainMuted.mutationOptions().mutationFn,
    onMutate: async ({
      trackedDomainId,
      muted,
    }: {
      trackedDomainId: string;
      muted: boolean;
    }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: DomainsData) =>
          old?.map((d) => (d.id === trackedDomainId ? { ...d, muted } : d)),
      );

      return { previousDomains: previousDomains as [unknown, unknown][] };
    },
    onError: (
      _err,
      _vars,
      context: { previousDomains: [unknown, unknown][] } | undefined,
    ) => {
      if (context?.previousDomains) {
        rollbackDomains(context.previousDomains);
      }
      toast.error("Failed to update notification settings");
    },
    onSuccess: (_data, { muted }) =>
      toast.success(muted ? "Domain muted" : "Domain unmuted"),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey }),
  });

  // ---------------------------------------------------------------------------
  // Bulk Archive Mutation
  // ---------------------------------------------------------------------------

  const bulkArchiveMutation = useMutation({
    mutationFn: trpc.tracking.bulkArchiveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }: { trackedDomainIds: string[] }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      const idsSet = new Set(trackedDomainIds);
      let archiveCount = 0;
      for (const [, domains] of previousDomains) {
        if (!domains) continue;
        for (const d of domains as TrackedDomainWithDetails[]) {
          if (idsSet.has(d.id) && !d.archivedAt) archiveCount++;
        }
      }

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: DomainsData) =>
          old?.map((d) =>
            idsSet.has(d.id) ? { ...d, archivedAt: new Date() } : d,
          ),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(
        subscriptionQueryKey,
        (old) => {
          if (!old) return old;
          const newActiveCount = Math.max(0, old.activeCount - archiveCount);
          return {
            ...old,
            activeCount: newActiveCount,
            archivedCount: old.archivedCount + archiveCount,
            canAddMore: newActiveCount < old.planQuota,
          };
        },
      );

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (_err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) {
        rollbackDomains(context.previousDomains);
      }
      if (context?.previousSubscription) {
        queryClient.setQueryData(
          subscriptionQueryKey,
          context.previousSubscription,
        );
      }
      toast.error("Failed to archive domains");
    },
    onSettled: invalidateDomainQueries,
  });

  // ---------------------------------------------------------------------------
  // Bulk Delete Mutation
  // ---------------------------------------------------------------------------

  const bulkDeleteMutation = useMutation({
    mutationFn: trpc.tracking.bulkRemoveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }: { trackedDomainIds: string[] }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      const idsSet = new Set(trackedDomainIds);
      let deleteCount = 0;
      for (const [, domains] of previousDomains) {
        if (!domains) continue;
        for (const d of domains as TrackedDomainWithDetails[]) {
          if (idsSet.has(d.id) && !d.archivedAt) deleteCount++;
        }
      }

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: DomainsData) => old?.filter((d) => !idsSet.has(d.id)),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(
        subscriptionQueryKey,
        (old) => {
          if (!old) return old;
          const newActiveCount = Math.max(0, old.activeCount - deleteCount);
          return {
            ...old,
            activeCount: newActiveCount,
            canAddMore: newActiveCount < old.planQuota,
          };
        },
      );

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (_err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) {
        rollbackDomains(context.previousDomains);
      }
      if (context?.previousSubscription) {
        queryClient.setQueryData(
          subscriptionQueryKey,
          context.previousSubscription,
        );
      }
      toast.error("Failed to delete domains");
    },
    onSettled: invalidateDomainQueries,
  });

  // ---------------------------------------------------------------------------
  // Wrapped Handlers
  // ---------------------------------------------------------------------------

  const remove = useCallback(
    (trackedDomainId: string) => {
      removeMutation.mutate({ trackedDomainId });
    },
    [removeMutation],
  );

  const archive = useCallback(
    (trackedDomainId: string) => {
      archiveMutation.mutate({ trackedDomainId });
    },
    [archiveMutation],
  );

  const unarchive = useCallback(
    (trackedDomainId: string) => {
      unarchiveMutation.mutate({ trackedDomainId });
    },
    [unarchiveMutation],
  );

  const setMuted = useCallback(
    (trackedDomainId: string, muted: boolean) => {
      muteMutation.mutate({ trackedDomainId, muted });
    },
    [muteMutation],
  );

  const bulkArchive = useCallback(
    async (trackedDomainIds: string[]): Promise<BulkMutationResult> =>
      bulkArchiveMutation.mutateAsync({ trackedDomainIds }),
    [bulkArchiveMutation],
  );

  const bulkDelete = useCallback(
    async (trackedDomainIds: string[]): Promise<BulkMutationResult> =>
      bulkDeleteMutation.mutateAsync({ trackedDomainIds }),
    [bulkDeleteMutation],
  );

  return {
    remove,
    archive,
    unarchive,
    setMuted,
    bulkArchive,
    bulkDelete,
    isRemoving: removeMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isUnarchiving: unarchiveMutation.isPending,
    isMuting: muteMutation.isPending,
    isBulkArchiving: bulkArchiveMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
  };
}
