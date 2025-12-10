"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { toast } from "sonner";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { logger } from "@/lib/logger/client";
import { useTRPC } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/routers/_app";

/**
 * Inferred router outputs for type-safe cache updates.
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * Limits data shape inferred from tracking.getLimits procedure.
 * Using inference ensures client types stay in sync with server.
 */
type LimitsData = RouterOutputs["tracking"]["getLimits"];

/**
 * Paginated domains data shape from tracking.listDomains procedure.
 */
type DomainsData = RouterOutputs["tracking"]["listDomains"];

/**
 * Infinite query data shape for domains.
 */
type InfiniteDomainsData = InfiniteData<DomainsData, string | null>;

/**
 * Shared context type for optimistic update rollback.
 * Stores snapshots of all query caches that may be modified.
 */
type MutationContext = {
  previousDomainsQueries?: [
    readonly unknown[],
    InfiniteDomainsData | undefined,
  ][];
  previousArchived?: TrackedDomainWithDetails[];
  previousLimits?: LimitsData;
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
 * Helper to update limits cache for removing domains from active list.
 */
function updateLimitsForRemoval(
  old: LimitsData | undefined,
  count: number,
): LimitsData | undefined {
  if (!old) return old;
  const newActiveCount = Math.max(0, old.activeCount - count);
  return {
    ...old,
    activeCount: newActiveCount,
    canAddMore: newActiveCount < old.maxDomains,
  };
}

/**
 * Helper to update limits cache for archiving domains.
 */
function updateLimitsForArchive(
  old: LimitsData | undefined,
  count: number,
): LimitsData | undefined {
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
 * Helper to update limits cache for unarchiving domains.
 */
function updateLimitsForUnarchive(
  old: LimitsData | undefined,
  count: number,
): LimitsData | undefined {
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
  const limitsQueryKey = trpc.tracking.getLimits.queryKey();
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const archivedDomainsQueryKey = trpc.tracking.listArchivedDomains.queryKey();

  /**
   * Cancel all domain-related queries to prevent race conditions.
   * Uses partial matching to catch infinite queries with different inputs.
   */
  const cancelQueries = async (includeArchived = false) => {
    await queryClient.cancelQueries({
      queryKey: domainsQueryKey,
      exact: false,
    });
    await queryClient.cancelQueries({ queryKey: limitsQueryKey });
    if (includeArchived) {
      await queryClient.cancelQueries({ queryKey: archivedDomainsQueryKey });
    }
  };

  /**
   * Invalidate all domain-related queries after mutation.
   * Uses exact: false for domains to match infinite queries with different inputs.
   */
  const invalidateQueries = (includeArchived = false) => {
    void queryClient.invalidateQueries({
      queryKey: domainsQueryKey,
      exact: false,
    });
    void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
    if (includeArchived) {
      void queryClient.invalidateQueries({ queryKey: archivedDomainsQueryKey });
    }
  };

  /**
   * Rollback cache to previous state on error.
   */
  const rollback = (context: MutationContext | undefined) => {
    // Restore all infinite query snapshots
    if (context?.previousDomainsQueries) {
      for (const [queryKey, data] of context.previousDomainsQueries) {
        queryClient.setQueryData(queryKey, data);
      }
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
  };

  // Remove mutation with optimistic updates
  const removeMutation = useMutation({
    ...trpc.tracking.removeDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }): Promise<MutationContext> => {
      await cancelQueries();

      // Snapshot all matching infinite query caches for rollback
      const previousDomainsQueries =
        queryClient.getQueriesData<InfiniteDomainsData>({
          queryKey: domainsQueryKey,
        });
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      // Optimistically update all matching infinite query caches
      queryClient.setQueriesData<InfiniteDomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => {
              const originalLength = page.items.length;
              const filteredItems = page.items.filter(
                (d) => d.id !== trackedDomainId,
              );
              const removedCount = originalLength - filteredItems.length;
              return {
                ...page,
                items: filteredItems,
                totalCount: page.totalCount - removedCount,
              };
            }),
          };
        },
      );

      // Optimistically update limits
      queryClient.setQueryData<LimitsData>(limitsQueryKey, (old) =>
        updateLimitsForRemoval(old, 1),
      );

      return { previousDomainsQueries, previousLimits };
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
      await cancelQueries(true);

      // Snapshot all matching infinite query caches for rollback
      const previousDomainsQueries =
        queryClient.getQueriesData<InfiniteDomainsData>({
          queryKey: domainsQueryKey,
        });
      const previousArchived = queryClient.getQueryData<
        TrackedDomainWithDetails[]
      >(archivedDomainsQueryKey);
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      // Find the domain being archived from any page
      let domainToArchive: TrackedDomainWithDetails | undefined;
      for (const [, data] of previousDomainsQueries) {
        if (!data) continue;
        for (const page of data.pages) {
          const found = page.items.find((d) => d.id === trackedDomainId);
          if (found) {
            domainToArchive = found;
            break;
          }
        }
        if (domainToArchive) break;
      }

      // Move from active to archived - update all infinite query caches
      queryClient.setQueriesData<InfiniteDomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => {
              const originalLength = page.items.length;
              const filteredItems = page.items.filter(
                (d) => d.id !== trackedDomainId,
              );
              const removedCount = originalLength - filteredItems.length;
              return {
                ...page,
                items: filteredItems,
                totalCount: page.totalCount - removedCount,
              };
            }),
          };
        },
      );

      if (domainToArchive) {
        queryClient.setQueryData<TrackedDomainWithDetails[]>(
          archivedDomainsQueryKey,
          (old) => [
            ...(old ?? []),
            { ...domainToArchive, archivedAt: new Date() },
          ],
        );
      }

      queryClient.setQueryData<LimitsData>(limitsQueryKey, (old) =>
        updateLimitsForArchive(old, 1),
      );

      return { previousDomainsQueries, previousArchived, previousLimits };
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
      invalidateQueries(true);
    },
  });

  // Unarchive mutation with optimistic updates
  const unarchiveMutation = useMutation({
    ...trpc.tracking.unarchiveDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }): Promise<MutationContext> => {
      await cancelQueries(true);

      // Snapshot all matching infinite query caches for rollback
      const previousDomainsQueries =
        queryClient.getQueriesData<InfiniteDomainsData>({
          queryKey: domainsQueryKey,
        });
      const previousArchived = queryClient.getQueryData<
        TrackedDomainWithDetails[]
      >(archivedDomainsQueryKey);
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      // Find the domain being unarchived
      const domainToUnarchive = previousArchived?.find(
        (d) => d.id === trackedDomainId,
      );

      // Move from archived to active
      queryClient.setQueryData<TrackedDomainWithDetails[]>(
        archivedDomainsQueryKey,
        (old) => old?.filter((d) => d.id !== trackedDomainId) ?? [],
      );

      if (domainToUnarchive) {
        // Add to the first page of all infinite query caches
        queryClient.setQueriesData<InfiniteDomainsData>(
          { queryKey: domainsQueryKey },
          (old) => {
            if (!old || old.pages.length === 0) return old;
            return {
              ...old,
              pages: old.pages.map((page, index) => {
                // Only add to the first page
                if (index === 0) {
                  return {
                    ...page,
                    items: [
                      ...page.items,
                      { ...domainToUnarchive, archivedAt: null },
                    ],
                    totalCount: page.totalCount + 1,
                  };
                }
                return {
                  ...page,
                  totalCount: page.totalCount + 1,
                };
              }),
            };
          },
        );
      }

      queryClient.setQueryData<LimitsData>(limitsQueryKey, (old) =>
        updateLimitsForUnarchive(old, 1),
      );

      return { previousDomainsQueries, previousArchived, previousLimits };
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
      invalidateQueries(true);
    },
  });

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: trpc.tracking.bulkArchiveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }): Promise<MutationContext> => {
      await cancelQueries(true);

      // Snapshot all matching infinite query caches for rollback
      const previousDomainsQueries =
        queryClient.getQueriesData<InfiniteDomainsData>({
          queryKey: domainsQueryKey,
        });
      const previousArchived = queryClient.getQueryData<
        TrackedDomainWithDetails[]
      >(archivedDomainsQueryKey);
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      const idsSet = new Set(trackedDomainIds);

      // Find all domains to archive from any page, deduplicated by id
      // (multiple cached queries may have overlapping data)
      const domainsToArchiveMap = new Map<string, TrackedDomainWithDetails>();
      for (const [, data] of previousDomainsQueries) {
        if (!data) continue;
        for (const page of data.pages) {
          for (const d of page.items) {
            if (idsSet.has(d.id) && !domainsToArchiveMap.has(d.id)) {
              domainsToArchiveMap.set(d.id, d);
            }
          }
        }
      }
      const domainsToArchive = Array.from(domainsToArchiveMap.values());
      const archiveDelta = domainsToArchive.length;

      // Move from active to archived - update all infinite query caches
      queryClient.setQueriesData<InfiniteDomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => {
              const originalLength = page.items.length;
              const filteredItems = page.items.filter((d) => !idsSet.has(d.id));
              const removedCount = originalLength - filteredItems.length;
              return {
                ...page,
                items: filteredItems,
                totalCount: page.totalCount - removedCount,
              };
            }),
          };
        },
      );

      if (domainsToArchive.length > 0) {
        queryClient.setQueryData<TrackedDomainWithDetails[]>(
          archivedDomainsQueryKey,
          (old) => [
            ...(old ?? []),
            ...domainsToArchive.map((d) => ({ ...d, archivedAt: new Date() })),
          ],
        );
      }

      queryClient.setQueryData<LimitsData>(limitsQueryKey, (old) =>
        updateLimitsForArchive(old, archiveDelta),
      );

      return { previousDomainsQueries, previousArchived, previousLimits };
    },
    onError: (err, _variables, context) => {
      rollback(context);
      logger.error("Failed to bulk archive domains", err);
      toast.error("Failed to archive domains");
    },
    onSettled: () => {
      invalidateQueries(true);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: trpc.tracking.bulkRemoveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }): Promise<MutationContext> => {
      await cancelQueries();

      // Snapshot all matching infinite query caches for rollback
      const previousDomainsQueries =
        queryClient.getQueriesData<InfiniteDomainsData>({
          queryKey: domainsQueryKey,
        });
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      const idsSet = new Set(trackedDomainIds);

      // Count domains to delete from cache, deduplicated by id
      // (multiple cached queries may have overlapping data)
      const seenIds = new Set<string>();
      for (const [, data] of previousDomainsQueries) {
        if (!data) continue;
        for (const page of data.pages) {
          for (const d of page.items) {
            if (idsSet.has(d.id)) {
              seenIds.add(d.id);
            }
          }
        }
      }
      const deleteDelta = seenIds.size;

      // Update all infinite query caches
      queryClient.setQueriesData<InfiniteDomainsData>(
        { queryKey: domainsQueryKey },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => {
              const originalLength = page.items.length;
              const filteredItems = page.items.filter((d) => !idsSet.has(d.id));
              const removedCount = originalLength - filteredItems.length;
              return {
                ...page,
                items: filteredItems,
                totalCount: page.totalCount - removedCount,
              };
            }),
          };
        },
      );

      queryClient.setQueryData<LimitsData>(limitsQueryKey, (old) =>
        updateLimitsForRemoval(old, deleteDelta),
      );

      return { previousDomainsQueries, previousLimits };
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
