"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { TrackedDomainWithDetails } from "@/lib/types";
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

export type UseTrackedDomainsOptions = {
  /** Whether to include archived domains in the results (defaults to false) */
  includeArchived?: boolean;
  /** Whether to enable the query (defaults to true) */
  enabled?: boolean;
};

/**
 * Return type for useTrackedDomains hook.
 * Uses ReturnType to capture the exact inferred type from the hook.
 */
export type UseTrackedDomainsReturn = ReturnType<typeof useTrackedDomains>;

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
    canAddMore: newActiveCount < old.planQuota,
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
    canAddMore: newActiveCount < old.planQuota,
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
    canAddMore: newActiveCount < old.planQuota,
  };
}

/**
 * Hook to fetch and manage user's tracked domains with mutations.
 * Provides both read operations (query) and write operations (mutations with optimistic updates).
 *
 * @param options - Configuration options
 * @param options.includeArchived - Whether to include archived domains (defaults to false)
 * @param options.enabled - Whether to enable the query (defaults to true)
 *
 * @example
 * ```tsx
 * function DomainList() {
 *   const { domains, isLoading, removeMutation } = useTrackedDomains();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ul>
 *       {domains?.map((d) => (
 *         <li key={d.id}>
 *           {d.domainName}
 *           <button onClick={() => removeMutation.mutate({ trackedDomainId: d.id })}>
 *             Remove
 *           </button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Include archived domains
 * function AllDomains() {
 *   const { domains, archiveMutation, unarchiveMutation } = useTrackedDomains({
 *     includeArchived: true,
 *   });
 *
 *   return <DomainGrid domains={domains} onArchive={archiveMutation} />;
 * }
 * ```
 */
export function useTrackedDomains(options: UseTrackedDomainsOptions = {}) {
  const { includeArchived = false, enabled = true } = options;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for cache manipulation
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const subscriptionQueryKey = trpc.user.getSubscription.queryKey();

  // Fetch tracked domains
  const query = useQuery({
    ...trpc.tracking.listDomains.queryOptions({ includeArchived }),
    enabled,
  });

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
  const invalidateQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    void queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
  }, [queryClient, domainsQueryKey, subscriptionQueryKey]);

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
    onError: (_err, _variables, context) => {
      rollback(context);
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
    onError: (_err, _variables, context) => {
      rollback(context);
      toast.error("Failed to archive domain");
    },
    onSuccess: () => {
      toast.success("Domain archived");
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
      // Show server error message (e.g., "You've reached your domain limit")
      const message =
        err instanceof Error ? err.message : "Failed to reactivate domain";
      toast.error(message);
    },
    onSuccess: () => {
      toast.success("Domain reactivated");
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
    onError: (_err, _variables, context) => {
      rollback(context);
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
    onError: (_err, _variables, context) => {
      rollback(context);
      toast.error("Failed to delete domains");
    },
    onSettled: () => {
      invalidateQueries();
    },
  });

  return {
    // Query results
    domains: query.data as TrackedDomainWithDetails[] | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,

    // Mutations
    removeMutation,
    archiveMutation,
    unarchiveMutation,
    bulkArchiveMutation,
    bulkDeleteMutation,

    /** Invalidate domain-related queries (useful after add domain) */
    invalidateQueries,
  };
}
