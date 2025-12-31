"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { toast } from "sonner";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/routers/_app";

/**
 * Inferred router outputs for type-safe cache updates.
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * Subscription data shape inferred from user.getSubscription procedure.
 * Using inference ensures client types stay in sync with server.
 */
type SubscriptionData = RouterOutputs["user"]["getSubscription"];

/**
 * Domains data shape from tracking.listDomains procedure.
 */
type DomainsData = RouterOutputs["tracking"]["listDomains"];

/**
 * Snapshot of a single query's cached data for rollback.
 */
type QuerySnapshot<T> = [queryKey: readonly unknown[], data: T | undefined];

/**
 * Shared context type for optimistic update rollback.
 * Stores snapshots of all query caches that may be modified.
 * Uses array of snapshots to support multiple query variants (e.g., with/without includeArchived).
 */
type MutationContext = {
  previousDomains?: QuerySnapshot<DomainsData>[];
  previousSubscription?: SubscriptionData;
};

/**
 * Return type for useDomainMutations hook.
 * Uses ReturnType to capture the exact inferred type from the hook.
 */
export type UseDomainMutationsReturn = ReturnType<typeof useDomainMutations>;

/**
 * Options for domain mutation handlers.
 */
type MutationHandlerOptions = {
  onArchiveSuccess?: () => void;
  onUnarchiveSuccess?: () => void;
};

/**
 * Helper to update subscription cache for removing domains from active list.
 */
function updateSubscriptionForRemoval(
  old: SubscriptionData | undefined,
  count: number,
): SubscriptionData | undefined {
  if (!old) return old;
  const newActiveCount = Math.max(0, old.activeCount - count);
  return {
    ...old,
    activeCount: newActiveCount,
    canAddMore: newActiveCount < old.maxDomains,
  };
}

/**
 * Helper to update subscription cache for archiving domains.
 */
function updateSubscriptionForArchive(
  old: SubscriptionData | undefined,
  count: number,
): SubscriptionData | undefined {
  if (!old) return old;
  const newActiveCount = Math.max(0, old.activeCount - count);
  return {
    ...old,
    activeCount: newActiveCount,
    archivedCount: old.archivedCount + count,
    canAddMore: newActiveCount < old.maxDomains,
  };
}

/**
 * Helper to update subscription cache for unarchiving domains.
 */
function updateSubscriptionForUnarchive(
  old: SubscriptionData | undefined,
  count: number,
): SubscriptionData | undefined {
  if (!old) return old;
  const newActiveCount = old.activeCount + count;
  return {
    ...old,
    activeCount: newActiveCount,
    archivedCount: Math.max(0, old.archivedCount - count),
    canAddMore: newActiveCount < old.maxDomains,
  };
}

/**
 * Hook that provides all domain-related mutations with optimistic updates.
 *
 * Centralizes cache update logic to ensure consistent semantics across
 * remove, archive, unarchive, and bulk operations.
 */
export function useDomainMutations(options: MutationHandlerOptions = {}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for cache manipulation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const subscriptionQueryKey = trpc.user.getSubscription.queryKey();

  /**
   * Cancel all domain-related queries to prevent race conditions.
   */
  const cancelQueries = async () => {
    await queryClient.cancelQueries({ queryKey: domainsQueryKey });
    await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });
  };

  /**
   * Invalidate all domain-related queries after mutation.
   */
  const invalidateQueries = () => {
    void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    void queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
  };

  /**
   * Rollback cache to previous state on error.
   * Restores all query variants that were snapshotted during onMutate.
   */
  const rollback = (context: MutationContext | undefined) => {
    if (context?.previousDomains) {
      for (const [key, data] of context.previousDomains) {
        queryClient.setQueryData(key, data);
      }
    }
    if (context?.previousSubscription) {
      queryClient.setQueryData(
        subscriptionQueryKey,
        context.previousSubscription,
      );
    }
  };

  // Remove mutation with optimistic updates
  const removeMutation = useMutation({
    ...trpc.tracking.removeDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }): Promise<MutationContext> => {
      await cancelQueries();

      // Snapshot all domain query variants (e.g., with/without includeArchived)
      const previousDomains = queryClient.getQueriesData<DomainsData>({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      // Optimistically remove domain from all query variants
      queryClient.setQueriesData<DomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return old.filter((d) => d.id !== trackedDomainId);
        },
      );

      // Optimistically update subscription
      queryClient.setQueryData<SubscriptionData>(subscriptionQueryKey, (old) =>
        updateSubscriptionForRemoval(old, 1),
      );

      return { previousDomains, previousSubscription };
    },
    onError: (err, _variables, context) => {
      rollback(context);
      logger.error("Failed to remove domain", err);
      toast.error("Failed to remove domain");
    },
    onSuccess: () => {
      toast.success("Domain removed");
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  // Archive mutation with optimistic updates
  const archiveMutation = useMutation({
    ...trpc.tracking.archiveDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }): Promise<MutationContext> => {
      await cancelQueries();

      // Snapshot all domain query variants
      const previousDomains = queryClient.getQueriesData<DomainsData>({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      // Optimistically mark domain as archived in all query variants
      queryClient.setQueriesData<DomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return old.map((d) =>
            d.id === trackedDomainId ? { ...d, archivedAt: new Date() } : d,
          );
        },
      );

      queryClient.setQueryData<SubscriptionData>(subscriptionQueryKey, (old) =>
        updateSubscriptionForArchive(old, 1),
      );

      return { previousDomains, previousSubscription };
    },
    onError: (err, _variables, context) => {
      rollback(context);
      logger.error("Failed to archive domain", err);
      toast.error("Failed to archive domain");
    },
    onSuccess: () => {
      toast.success("Domain archived");
      options.onArchiveSuccess?.();
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  // Unarchive mutation with optimistic updates
  const unarchiveMutation = useMutation({
    ...trpc.tracking.unarchiveDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }): Promise<MutationContext> => {
      await cancelQueries();

      // Snapshot all domain query variants
      const previousDomains = queryClient.getQueriesData<DomainsData>({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      // Optimistically mark domain as unarchived in all query variants
      queryClient.setQueriesData<DomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return old.map((d) =>
            d.id === trackedDomainId ? { ...d, archivedAt: null } : d,
          );
        },
      );

      queryClient.setQueryData<SubscriptionData>(subscriptionQueryKey, (old) =>
        updateSubscriptionForUnarchive(old, 1),
      );

      return { previousDomains, previousSubscription };
    },
    onError: (err, _variables, context) => {
      rollback(context);
      logger.error("Failed to unarchive domain", err);
      // Show server error message (e.g., "You've reached your domain limit")
      const message =
        err instanceof Error ? err.message : "Failed to reactivate domain";
      toast.error(message);
    },
    onSuccess: () => {
      toast.success("Domain reactivated");
      options.onUnarchiveSuccess?.();
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: trpc.tracking.bulkArchiveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }): Promise<MutationContext> => {
      await cancelQueries();

      // Snapshot all domain query variants
      const previousDomains = queryClient.getQueriesData<DomainsData>({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      const idsSet = new Set(trackedDomainIds);

      // Count how many will be archived (use first cached query to count)
      const firstCachedDomains = previousDomains[0]?.[1];
      const archiveCount =
        firstCachedDomains?.filter((d) => idsSet.has(d.id)).length ?? 0;

      // Optimistically mark domains as archived in all query variants
      queryClient.setQueriesData<DomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return old.map((d) =>
            idsSet.has(d.id) ? { ...d, archivedAt: new Date() } : d,
          );
        },
      );

      queryClient.setQueryData<SubscriptionData>(subscriptionQueryKey, (old) =>
        updateSubscriptionForArchive(old, archiveCount),
      );

      return { previousDomains, previousSubscription };
    },
    onError: (err, _variables, context) => {
      rollback(context);
      logger.error("Failed to bulk archive domains", err);
      toast.error("Failed to archive domains");
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: trpc.tracking.bulkRemoveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }): Promise<MutationContext> => {
      await cancelQueries();

      // Snapshot all domain query variants
      const previousDomains = queryClient.getQueriesData<DomainsData>({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      const idsSet = new Set(trackedDomainIds);

      // Count how many will be deleted (use first cached query to count)
      const firstCachedDomains = previousDomains[0]?.[1];
      const deleteCount =
        firstCachedDomains?.filter((d) => idsSet.has(d.id)).length ?? 0;

      // Optimistically remove domains from all query variants
      queryClient.setQueriesData<DomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return old.filter((d) => !idsSet.has(d.id));
        },
      );

      queryClient.setQueryData<SubscriptionData>(subscriptionQueryKey, (old) =>
        updateSubscriptionForRemoval(old, deleteCount),
      );

      return { previousDomains, previousSubscription };
    },
    onError: (err, _variables, context) => {
      rollback(context);
      logger.error("Failed to bulk delete domains", err);
      toast.error("Failed to delete domains");
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  return {
    removeMutation,
    archiveMutation,
    unarchiveMutation,
    bulkArchiveMutation,
    bulkDeleteMutation,
    /** Invalidate domain-related queries (useful after add domain) */
    invalidateQueries,
  };
}
