import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import type { TrackedDomainWithDetails } from "@domainstack/types";

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

function toastBulkResult(
  verb: "Archived" | "Deleted" | "Muted" | "Unmuted",
  result: BulkMutationResult,
  requestedCount: number,
) {
  if (result.failedCount === 0) {
    toast.success(`${verb} ${requestedCount} domain${requestedCount === 1 ? "" : "s"}`);
    return;
  }

  toast.warning(
    `${verb} ${result.successCount} of ${requestedCount} domains (${result.failedCount} failed)`,
  );
}

// Count affected domains by their current lifecycle state, deduped across
// every cached listDomains variant so a domain present in multiple entries
// (e.g. includeArchived true/false) is counted once. The subscription delta
// must reflect actual state transitions, not a blind ±1.
function affectedCounts(previousDomains: [unknown, unknown][], ids: Iterable<string>) {
  const idSet = new Set(ids);
  const seen = new Set<string>();
  let active = 0;
  let archived = 0;
  for (const [, domains] of previousDomains) {
    if (!domains) continue;
    for (const d of domains as TrackedDomainWithDetails[]) {
      if (!idSet.has(d.id) || seen.has(d.id)) continue;
      seen.add(d.id);
      if (d.archivedAt) archived += 1;
      else active += 1;
    }
  }
  return { active, archived };
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
  bulkSetMuted: (trackedDomainIds: string[], muted: boolean) => Promise<BulkMutationResult>;

  // Loading states
  isRemoving: boolean;
  isArchiving: boolean;
  isUnarchiving: boolean;
  isMuting: boolean;
  isBulkArchiving: boolean;
  isBulkDeleting: boolean;
  isBulkMuting: boolean;
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

  const domainsFilter = trpc.tracking.listDomains.queryFilter();
  const subscriptionFilter = trpc.user.getSubscription.queryFilter();
  const subscriptionQueryKey = trpc.user.getSubscription.queryKey();

  const invalidateDomainQueries = useCallback(() => {
    void queryClient.invalidateQueries(domainsFilter);
    void queryClient.invalidateQueries(subscriptionFilter);
  }, [queryClient, domainsFilter, subscriptionFilter]);

  // Helper to rollback domain queries
  const rollbackDomains = (previousDomains: [unknown, unknown][]) => {
    for (const [key, data] of previousDomains) {
      queryClient.setQueryData(key as string[], data);
    }
  };

  // ---------------------------------------------------------------------------
  // Remove Mutation
  // ---------------------------------------------------------------------------

  const removeMutation = useMutation(
    trpc.tracking.removeDomain.mutationOptions({
      onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
        await queryClient.cancelQueries(domainsFilter);
        await queryClient.cancelQueries(subscriptionFilter);

        const previousDomains = queryClient.getQueriesData(domainsFilter);
        const previousSubscription =
          queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

        const { active, archived } = affectedCounts(previousDomains as [unknown, unknown][], [
          trackedDomainId,
        ]);

        queryClient.setQueriesData(domainsFilter, (old: DomainsData) =>
          old?.filter((d) => d.id !== trackedDomainId),
        );
        queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
          if (!old) return old;
          const activeCount = Math.max(0, old.activeCount - active);
          const archivedCount = Math.max(0, old.archivedCount - archived);
          return {
            ...old,
            activeCount,
            archivedCount,
            canAddMore: activeCount < old.planQuota,
          };
        });

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
          queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
        }
        toast.error("Failed to remove domain");
      },
      onSuccess: () => toast.success("Domain removed"),
      onSettled: invalidateDomainQueries,
    }),
  );

  // ---------------------------------------------------------------------------
  // Archive Mutation
  // ---------------------------------------------------------------------------

  const archiveMutation = useMutation(
    trpc.tracking.archiveDomain.mutationOptions({
      onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
        await queryClient.cancelQueries(domainsFilter);
        await queryClient.cancelQueries(subscriptionFilter);

        const previousDomains = queryClient.getQueriesData(domainsFilter);
        const previousSubscription =
          queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

        const { active: toArchive } = affectedCounts(previousDomains as [unknown, unknown][], [
          trackedDomainId,
        ]);

        queryClient.setQueriesData(domainsFilter, (old: DomainsData) =>
          old?.map((d) => (d.id === trackedDomainId ? { ...d, archivedAt: new Date() } : d)),
        );
        queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
          if (!old) return old;
          const activeCount = Math.max(0, old.activeCount - toArchive);
          return {
            ...old,
            activeCount,
            archivedCount: old.archivedCount + toArchive,
            canAddMore: activeCount < old.planQuota,
          };
        });

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
          queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
        }
        toast.error("Failed to archive domain");
      },
      onSuccess: () => toast.success("Domain archived"),
      onSettled: invalidateDomainQueries,
    }),
  );

  // ---------------------------------------------------------------------------
  // Unarchive Mutation
  // ---------------------------------------------------------------------------

  const unarchiveMutation = useMutation(
    trpc.tracking.unarchiveDomain.mutationOptions({
      onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
        await queryClient.cancelQueries(domainsFilter);
        await queryClient.cancelQueries(subscriptionFilter);

        const previousDomains = queryClient.getQueriesData(domainsFilter);
        const previousSubscription =
          queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

        const { archived: toActivate } = affectedCounts(previousDomains as [unknown, unknown][], [
          trackedDomainId,
        ]);

        queryClient.setQueriesData(domainsFilter, (old: DomainsData) =>
          old?.map((d) => (d.id === trackedDomainId ? { ...d, archivedAt: null } : d)),
        );
        queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
          if (!old) return old;
          const activeCount = old.activeCount + toActivate;
          return {
            ...old,
            activeCount,
            archivedCount: Math.max(0, old.archivedCount - toActivate),
            canAddMore: activeCount < old.planQuota,
          };
        });

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
          queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
        }
        toast.error(err instanceof Error ? err.message : "Failed to reactivate domain");
      },
      onSuccess: () => toast.success("Domain reactivated"),
      onSettled: invalidateDomainQueries,
    }),
  );

  // ---------------------------------------------------------------------------
  // Mute Mutation
  // ---------------------------------------------------------------------------

  const muteMutation = useMutation(
    trpc.user.setDomainMuted.mutationOptions({
      onMutate: async ({ trackedDomainId, muted }: { trackedDomainId: string; muted: boolean }) => {
        await queryClient.cancelQueries(domainsFilter);

        const previousDomains = queryClient.getQueriesData(domainsFilter);

        queryClient.setQueriesData(domainsFilter, (old: DomainsData) =>
          old?.map((d) => (d.id === trackedDomainId ? { ...d, muted } : d)),
        );

        return { previousDomains: previousDomains as [unknown, unknown][] };
      },
      onError: (_err, _vars, context: { previousDomains: [unknown, unknown][] } | undefined) => {
        if (context?.previousDomains) {
          rollbackDomains(context.previousDomains);
        }
        toast.error("Failed to update notification settings");
      },
      onSuccess: (_data, { muted }) => toast.success(muted ? "Domain muted" : "Domain unmuted"),
      onSettled: () => void queryClient.invalidateQueries(domainsFilter),
    }),
  );

  // ---------------------------------------------------------------------------
  // Bulk Archive Mutation
  // ---------------------------------------------------------------------------

  const bulkArchiveMutation = useMutation(
    trpc.tracking.bulkArchiveDomains.mutationOptions({
      onMutate: async ({ trackedDomainIds }: { trackedDomainIds: string[] }) => {
        await queryClient.cancelQueries(domainsFilter);
        await queryClient.cancelQueries(subscriptionFilter);

        const previousDomains = queryClient.getQueriesData(domainsFilter);
        const previousSubscription =
          queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

        const idsSet = new Set(trackedDomainIds);
        const { active: archiveCount } = affectedCounts(
          previousDomains as [unknown, unknown][],
          idsSet,
        );

        queryClient.setQueriesData(domainsFilter, (old: DomainsData) =>
          old?.map((d) =>
            idsSet.has(d.id) && !d.archivedAt ? { ...d, archivedAt: new Date() } : d,
          ),
        );
        queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
          if (!old) return old;
          const activeCount = Math.max(0, old.activeCount - archiveCount);
          return {
            ...old,
            activeCount,
            archivedCount: old.archivedCount + archiveCount,
            canAddMore: activeCount < old.planQuota,
          };
        });

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
          queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
        }
        toast.error("Failed to archive domains");
      },
      onSettled: invalidateDomainQueries,
    }),
  );

  // ---------------------------------------------------------------------------
  // Bulk Delete Mutation
  // ---------------------------------------------------------------------------

  const bulkDeleteMutation = useMutation(
    trpc.tracking.bulkRemoveDomains.mutationOptions({
      onMutate: async ({ trackedDomainIds }: { trackedDomainIds: string[] }) => {
        await queryClient.cancelQueries(domainsFilter);
        await queryClient.cancelQueries(subscriptionFilter);

        const previousDomains = queryClient.getQueriesData(domainsFilter);
        const previousSubscription =
          queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

        const idsSet = new Set(trackedDomainIds);
        const { active: activeDeleted, archived: archivedDeleted } = affectedCounts(
          previousDomains as [unknown, unknown][],
          idsSet,
        );

        queryClient.setQueriesData(domainsFilter, (old: DomainsData) =>
          old?.filter((d) => !idsSet.has(d.id)),
        );
        queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
          if (!old) return old;
          const activeCount = Math.max(0, old.activeCount - activeDeleted);
          const archivedCount = Math.max(0, old.archivedCount - archivedDeleted);
          return {
            ...old,
            activeCount,
            archivedCount,
            canAddMore: activeCount < old.planQuota,
          };
        });

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
          queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
        }
        toast.error("Failed to delete domains");
      },
      onSettled: invalidateDomainQueries,
    }),
  );

  // ---------------------------------------------------------------------------
  // Bulk Mute Mutation
  // ---------------------------------------------------------------------------

  const bulkSetMutedMutation = useMutation(
    trpc.tracking.bulkSetMuted.mutationOptions({
      onMutate: async ({
        trackedDomainIds,
        muted,
      }: {
        trackedDomainIds: string[];
        muted: boolean;
      }) => {
        await queryClient.cancelQueries(domainsFilter);

        const previousDomains = queryClient.getQueriesData(domainsFilter);

        const idsSet = new Set(trackedDomainIds);
        queryClient.setQueriesData(domainsFilter, (old: DomainsData) =>
          old?.map((d) => (idsSet.has(d.id) ? { ...d, muted } : d)),
        );

        return { previousDomains: previousDomains as [unknown, unknown][] };
      },
      onError: (
        _err,
        { muted },
        context: { previousDomains: [unknown, unknown][] } | undefined,
      ) => {
        if (context?.previousDomains) {
          rollbackDomains(context.previousDomains);
        }
        toast.error(muted ? "Failed to mute domains" : "Failed to unmute domains");
      },
      onSettled: () => void queryClient.invalidateQueries(domainsFilter),
    }),
  );

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
    async (trackedDomainIds: string[]): Promise<BulkMutationResult> => {
      const result = await bulkArchiveMutation.mutateAsync({ trackedDomainIds });
      toastBulkResult("Archived", result, trackedDomainIds.length);
      return result;
    },
    [bulkArchiveMutation],
  );

  const bulkDelete = useCallback(
    async (trackedDomainIds: string[]): Promise<BulkMutationResult> => {
      const result = await bulkDeleteMutation.mutateAsync({ trackedDomainIds });
      toastBulkResult("Deleted", result, trackedDomainIds.length);
      return result;
    },
    [bulkDeleteMutation],
  );

  const bulkSetMuted = useCallback(
    async (trackedDomainIds: string[], muted: boolean): Promise<BulkMutationResult> => {
      const result = await bulkSetMutedMutation.mutateAsync({ trackedDomainIds, muted });
      toastBulkResult(muted ? "Muted" : "Unmuted", result, trackedDomainIds.length);
      return result;
    },
    [bulkSetMutedMutation],
  );

  return {
    remove,
    archive,
    unarchive,
    setMuted,
    bulkArchive,
    bulkDelete,
    bulkSetMuted,
    isRemoving: removeMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isUnarchiving: unarchiveMutation.isPending,
    isMuting: muteMutation.isPending,
    isBulkArchiving: bulkArchiveMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
    isBulkMuting: bulkSetMutedMutation.isPending,
  };
}
