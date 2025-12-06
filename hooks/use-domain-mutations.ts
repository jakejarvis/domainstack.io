"use client";

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
 * Shared context type for optimistic update rollback.
 */
type MutationContext = {
  previousDomains?: TrackedDomainWithDetails[];
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
   */
  const cancelQueries = async (includeArchived = false) => {
    await queryClient.cancelQueries({ queryKey: domainsQueryKey });
    await queryClient.cancelQueries({ queryKey: limitsQueryKey });
    if (includeArchived) {
      await queryClient.cancelQueries({ queryKey: archivedDomainsQueryKey });
    }
  };

  /**
   * Invalidate all domain-related queries after mutation.
   */
  const invalidateQueries = (includeArchived = false) => {
    void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    void queryClient.invalidateQueries({ queryKey: limitsQueryKey });
    if (includeArchived) {
      void queryClient.invalidateQueries({ queryKey: archivedDomainsQueryKey });
    }
  };

  /**
   * Rollback cache to previous state on error.
   */
  const rollback = (context: MutationContext | undefined) => {
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
  };

  // Remove mutation with optimistic updates
  const removeMutation = useMutation({
    ...trpc.tracking.removeDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }): Promise<MutationContext> => {
      await cancelQueries();

      const previousDomains =
        queryClient.getQueryData<TrackedDomainWithDetails[]>(domainsQueryKey);
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      // Optimistically update domains list
      queryClient.setQueryData<TrackedDomainWithDetails[]>(
        domainsQueryKey,
        (old) => old?.filter((d) => d.id !== trackedDomainId) ?? [],
      );

      // Optimistically update limits
      queryClient.setQueryData<LimitsData>(limitsQueryKey, (old) =>
        updateLimitsForRemoval(old, 1),
      );

      return { previousDomains, previousLimits };
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

      const previousDomains =
        queryClient.getQueryData<TrackedDomainWithDetails[]>(domainsQueryKey);
      const previousArchived = queryClient.getQueryData<
        TrackedDomainWithDetails[]
      >(archivedDomainsQueryKey);
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      // Find the domain being archived
      const domainToArchive = previousDomains?.find(
        (d) => d.id === trackedDomainId,
      );

      // Move from active to archived
      queryClient.setQueryData<TrackedDomainWithDetails[]>(
        domainsQueryKey,
        (old) => old?.filter((d) => d.id !== trackedDomainId) ?? [],
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

      return { previousDomains, previousArchived, previousLimits };
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

      const previousDomains =
        queryClient.getQueryData<TrackedDomainWithDetails[]>(domainsQueryKey);
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
        queryClient.setQueryData<TrackedDomainWithDetails[]>(
          domainsQueryKey,
          (old) => [...(old ?? []), { ...domainToUnarchive, archivedAt: null }],
        );
      }

      queryClient.setQueryData<LimitsData>(limitsQueryKey, (old) =>
        updateLimitsForUnarchive(old, 1),
      );

      return { previousDomains, previousArchived, previousLimits };
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

      const previousDomains =
        queryClient.getQueryData<TrackedDomainWithDetails[]>(domainsQueryKey);
      const previousArchived = queryClient.getQueryData<
        TrackedDomainWithDetails[]
      >(archivedDomainsQueryKey);
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      const idsSet = new Set(trackedDomainIds);
      const domainsToArchive = previousDomains?.filter((d) => idsSet.has(d.id));
      // Use actual count of domains found in cache for consistent optimistic updates
      const archiveDelta = domainsToArchive?.length ?? 0;

      // Move from active to archived
      queryClient.setQueryData<TrackedDomainWithDetails[]>(
        domainsQueryKey,
        (old) => old?.filter((d) => !idsSet.has(d.id)) ?? [],
      );

      if (domainsToArchive && domainsToArchive.length > 0) {
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

      return { previousDomains, previousArchived, previousLimits };
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

      const previousDomains =
        queryClient.getQueryData<TrackedDomainWithDetails[]>(domainsQueryKey);
      const previousLimits =
        queryClient.getQueryData<LimitsData>(limitsQueryKey);

      const idsSet = new Set(trackedDomainIds);
      // Use actual count of domains found in cache for consistent optimistic updates
      const domainsToDelete = previousDomains?.filter((d) => idsSet.has(d.id));
      const deleteDelta = domainsToDelete?.length ?? 0;

      queryClient.setQueryData<TrackedDomainWithDetails[]>(
        domainsQueryKey,
        (old) => old?.filter((d) => !idsSet.has(d.id)) ?? [],
      );

      queryClient.setQueryData<LimitsData>(limitsQueryKey, (old) =>
        updateLimitsForRemoval(old, deleteDelta),
      );

      return { previousDomains, previousLimits };
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
