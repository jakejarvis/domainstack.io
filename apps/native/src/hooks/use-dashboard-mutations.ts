import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { TrackedDomainWithDetails } from "@domainstack/types";

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
  remove: (trackedDomainId: string) => Promise<unknown>;
  archive: (trackedDomainId: string) => Promise<unknown>;
  unarchive: (trackedDomainId: string) => Promise<unknown>;
  setMuted: (trackedDomainId: string, muted: boolean) => Promise<unknown>;

  bulkArchive: (trackedDomainIds: string[]) => Promise<BulkMutationResult>;
  bulkRemove: (trackedDomainIds: string[]) => Promise<BulkMutationResult>;
  bulkSetMuted: (trackedDomainIds: string[], muted: boolean) => Promise<BulkMutationResult>;

  isRemoving: boolean;
  isArchiving: boolean;
  isUnarchiving: boolean;
  isMuting: boolean;
  isBulkArchiving: boolean;
  isBulkRemoving: boolean;
  isBulkSettingMuted: boolean;
}

export function useDashboardMutations(): UseDashboardMutationsReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const subscriptionQueryKey = trpc.user.getSubscription.queryKey();

  const invalidateDomainQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    void queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
  }, [queryClient, domainsQueryKey, subscriptionQueryKey]);

  const rollbackDomains = (previousDomains: [unknown, unknown][]) => {
    for (const [key, data] of previousDomains) {
      queryClient.setQueryData(key as readonly unknown[], data);
    }
  };

  const removeMutation = useMutation({
    mutationFn: trpc.tracking.removeDomain.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({ queryKey: domainsQueryKey });
      const previousSubscription = queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      queryClient.setQueriesData({ queryKey: domainsQueryKey }, (old: DomainsData) =>
        old?.filter((d) => d.id !== trackedDomainId),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
        if (!old) return old;
        const newActiveCount = Math.max(0, old.activeCount - 1);
        return {
          ...old,
          activeCount: newActiveCount,
          canAddMore: newActiveCount < old.planQuota,
        };
      });

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (_err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) rollbackDomains(context.previousDomains);
      if (context?.previousSubscription) {
        queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
      }
      toast.error({ title: "Remove failed", message: _err.message });
    },
    onSettled: invalidateDomainQueries,
  });

  const archiveMutation = useMutation({
    mutationFn: trpc.tracking.archiveDomain.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({ queryKey: domainsQueryKey });
      const previousSubscription = queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      queryClient.setQueriesData({ queryKey: domainsQueryKey }, (old: DomainsData) =>
        old?.map((d) => (d.id === trackedDomainId ? { ...d, archivedAt: new Date() } : d)),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
        if (!old) return old;
        const newActiveCount = Math.max(0, old.activeCount - 1);
        return {
          ...old,
          activeCount: newActiveCount,
          archivedCount: old.archivedCount + 1,
          canAddMore: newActiveCount < old.planQuota,
        };
      });

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) rollbackDomains(context.previousDomains);
      if (context?.previousSubscription) {
        queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
      }
      toast.error({ title: "Archive failed", message: err.message });
    },
    onSettled: invalidateDomainQueries,
  });

  const unarchiveMutation = useMutation({
    mutationFn: trpc.tracking.unarchiveDomain.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainId }: { trackedDomainId: string }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({ queryKey: domainsQueryKey });
      const previousSubscription = queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      queryClient.setQueriesData({ queryKey: domainsQueryKey }, (old: DomainsData) =>
        old?.map((d) => (d.id === trackedDomainId ? { ...d, archivedAt: null } : d)),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
        if (!old) return old;
        const newActiveCount = old.activeCount + 1;
        return {
          ...old,
          activeCount: newActiveCount,
          archivedCount: Math.max(0, old.archivedCount - 1),
          canAddMore: newActiveCount < old.planQuota,
        };
      });

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) rollbackDomains(context.previousDomains);
      if (context?.previousSubscription) {
        queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
      }
      toast.error({ title: "Reactivation failed", message: err.message });
    },
    onSettled: invalidateDomainQueries,
  });

  const muteMutation = useMutation({
    mutationFn: trpc.user.setDomainMuted.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainId, muted }: { trackedDomainId: string; muted: boolean }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });

      const previousDomains = queryClient.getQueriesData({ queryKey: domainsQueryKey });

      queryClient.setQueriesData({ queryKey: domainsQueryKey }, (old: DomainsData) =>
        old?.map((d) => (d.id === trackedDomainId ? { ...d, muted } : d)),
      );

      return { previousDomains: previousDomains as [unknown, unknown][] };
    },
    onError: (err, _vars, context: { previousDomains: [unknown, unknown][] } | undefined) => {
      if (context?.previousDomains) rollbackDomains(context.previousDomains);
      toast.error({ title: "Mute failed", message: err.message });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: domainsQueryKey }),
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: trpc.tracking.bulkArchiveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }: { trackedDomainIds: string[] }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({ queryKey: domainsQueryKey });
      const previousSubscription = queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      const idsSet = new Set(trackedDomainIds);
      let archiveCount = 0;
      for (const [, domains] of previousDomains) {
        if (!domains) continue;
        for (const d of domains as TrackedDomainWithDetails[]) {
          if (idsSet.has(d.id) && !d.archivedAt) archiveCount++;
        }
      }

      queryClient.setQueriesData({ queryKey: domainsQueryKey }, (old: DomainsData) =>
        old?.map((d) => (idsSet.has(d.id) ? { ...d, archivedAt: new Date() } : d)),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
        if (!old) return old;
        const newActiveCount = Math.max(0, old.activeCount - archiveCount);
        return {
          ...old,
          activeCount: newActiveCount,
          archivedCount: old.archivedCount + archiveCount,
          canAddMore: newActiveCount < old.planQuota,
        };
      });

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) rollbackDomains(context.previousDomains);
      if (context?.previousSubscription) {
        queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
      }
      toast.error({ title: "Archive failed", message: err.message });
    },
    onSettled: invalidateDomainQueries,
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: trpc.tracking.bulkRemoveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }: { trackedDomainIds: string[] }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({ queryKey: domainsQueryKey });
      const previousSubscription = queryClient.getQueryData<SubscriptionData>(subscriptionQueryKey);

      const idsSet = new Set(trackedDomainIds);
      let deleteCount = 0;
      for (const [, domains] of previousDomains) {
        if (!domains) continue;
        for (const d of domains as TrackedDomainWithDetails[]) {
          if (idsSet.has(d.id) && !d.archivedAt) deleteCount++;
        }
      }

      queryClient.setQueriesData({ queryKey: domainsQueryKey }, (old: DomainsData) =>
        old?.filter((d) => !idsSet.has(d.id)),
      );
      queryClient.setQueryData<SubscriptionData | undefined>(subscriptionQueryKey, (old) => {
        if (!old) return old;
        const newActiveCount = Math.max(0, old.activeCount - deleteCount);
        return {
          ...old,
          activeCount: newActiveCount,
          canAddMore: newActiveCount < old.planQuota,
        };
      });

      return {
        previousDomains: previousDomains as [unknown, unknown][],
        previousSubscription,
      };
    },
    onError: (err, _vars, context: MutationContext | undefined) => {
      if (context?.previousDomains) rollbackDomains(context.previousDomains);
      if (context?.previousSubscription) {
        queryClient.setQueryData(subscriptionQueryKey, context.previousSubscription);
      }
      toast.error({ title: "Remove failed", message: err.message });
    },
    onSettled: invalidateDomainQueries,
  });

  const bulkSetMutedMutation = useMutation({
    mutationFn: trpc.tracking.bulkSetMuted.mutationOptions().mutationFn,
    onMutate: async ({
      trackedDomainIds,
      muted,
    }: {
      trackedDomainIds: string[];
      muted: boolean;
    }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });

      const previousDomains = queryClient.getQueriesData({ queryKey: domainsQueryKey });

      const idsSet = new Set(trackedDomainIds);
      queryClient.setQueriesData({ queryKey: domainsQueryKey }, (old: DomainsData) =>
        old?.map((d) => (idsSet.has(d.id) ? { ...d, muted } : d)),
      );

      return { previousDomains: previousDomains as [unknown, unknown][] };
    },
    onError: (err, vars, context: { previousDomains: [unknown, unknown][] } | undefined) => {
      if (context?.previousDomains) rollbackDomains(context.previousDomains);
      toast.error({
        title: vars.muted ? "Mute failed" : "Unmute failed",
        message: err.message,
      });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: domainsQueryKey }),
  });

  const remove = useCallback(
    (trackedDomainId: string) => removeMutation.mutateAsync({ trackedDomainId }),
    [removeMutation],
  );
  const archive = useCallback(
    (trackedDomainId: string) => archiveMutation.mutateAsync({ trackedDomainId }),
    [archiveMutation],
  );
  const unarchive = useCallback(
    (trackedDomainId: string) => unarchiveMutation.mutateAsync({ trackedDomainId }),
    [unarchiveMutation],
  );
  const setMuted = useCallback(
    (trackedDomainId: string, muted: boolean) =>
      muteMutation.mutateAsync({ trackedDomainId, muted }),
    [muteMutation],
  );
  const bulkArchive = useCallback(
    (trackedDomainIds: string[]) => bulkArchiveMutation.mutateAsync({ trackedDomainIds }),
    [bulkArchiveMutation],
  );
  const bulkRemove = useCallback(
    (trackedDomainIds: string[]) => bulkRemoveMutation.mutateAsync({ trackedDomainIds }),
    [bulkRemoveMutation],
  );
  const bulkSetMuted = useCallback(
    (trackedDomainIds: string[], muted: boolean) =>
      bulkSetMutedMutation.mutateAsync({ trackedDomainIds, muted }),
    [bulkSetMutedMutation],
  );

  return {
    remove,
    archive,
    unarchive,
    setMuted,
    bulkArchive,
    bulkRemove,
    bulkSetMuted,
    isRemoving: removeMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isUnarchiving: unarchiveMutation.isPending,
    isMuting: muteMutation.isPending,
    isBulkArchiving: bulkArchiveMutation.isPending,
    isBulkRemoving: bulkRemoveMutation.isPending,
    isBulkSettingMuted: bulkSetMutedMutation.isPending,
  };
}
