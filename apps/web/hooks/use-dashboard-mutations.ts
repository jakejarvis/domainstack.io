import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { toast } from "sonner";

import { selectedDomainIdsAtom } from "@/lib/atoms/dashboard-atoms";
import { useTRPC } from "@/lib/trpc/client";
import type { SubscriptionQuota, TrackedDomainWithDetails } from "@domainstack/types";

interface BulkMutationResult {
  successCount: number;
  failedCount: number;
}

type DomainsData = TrackedDomainWithDetails[] | undefined;

type LifecycleCounts = { active: number; archived: number };

/** An optimistic change to a set of tracked domains. */
interface DomainChange {
  ids: string[];
  /** The domain after the change, or `null` to drop it from the list. */
  update: (domain: TrackedDomainWithDetails) => TrackedDomainWithDetails | null;
  /** How the plan quota counts move, given the affected domains' current states. */
  quotaDelta?: (affected: LifecycleCounts) => LifecycleCounts;
}

interface Snapshot {
  previousDomains: [unknown, unknown][];
  /** Only captured when the change touched the quota. */
  previousSubscription?: SubscriptionQuota;
}

const removeDomains = (ids: string[]): DomainChange => ({
  ids,
  update: () => null,
  quotaDelta: ({ active, archived }) => ({ active: -active, archived: -archived }),
});

const archiveDomains = (ids: string[]): DomainChange => ({
  ids,
  update: (d) => (d.archivedAt ? d : { ...d, archivedAt: new Date() }),
  quotaDelta: ({ active }) => ({ active: -active, archived: active }),
});

const unarchiveDomains = (ids: string[]): DomainChange => ({
  ids,
  update: (d) => ({ ...d, archivedAt: null }),
  quotaDelta: ({ archived }) => ({ active: archived, archived: -archived }),
});

const muteDomains = (ids: string[], muted: boolean): DomainChange => ({
  ids,
  update: (d) => ({ ...d, muted }),
});

// Count affected domains by their current lifecycle state, deduped across
// every cached listDomains variant so a domain present in multiple entries
// (e.g. includeArchived true/false) is counted once. The subscription delta
// must reflect actual state transitions, not a blind ±1.
function affectedCounts(previousDomains: [unknown, unknown][], ids: Set<string>): LifecycleCounts {
  const seen = new Set<string>();
  const counts = { active: 0, archived: 0 };
  for (const [, domains] of previousDomains) {
    if (!domains) continue;
    for (const d of domains as TrackedDomainWithDetails[]) {
      if (!ids.has(d.id) || seen.has(d.id)) continue;
      seen.add(d.id);
      counts[d.archivedAt ? "archived" : "active"] += 1;
    }
  }
  return counts;
}

function toastBulkResult(
  verb: "Archived" | "Deleted" | "Muted" | "Unmuted",
  result: BulkMutationResult,
  requestedCount: number,
): BulkMutationResult {
  if (result.failedCount === 0) {
    toast.success(`${verb} ${requestedCount} domain${requestedCount === 1 ? "" : "s"}`);
  } else {
    toast.warning(
      `${verb} ${result.successCount} of ${requestedCount} domains (${result.failedCount} failed)`,
    );
  }
  return result;
}

/**
 * Dashboard domain mutations. Every one applies its change optimistically to
 * all cached `listDomains` variants (and the plan quota when counts move),
 * rolls back and toasts on error, and refetches on settle.
 *
 * Single-domain and bulk variants hit different endpoints but share the same
 * {@link DomainChange}, so they can't drift apart.
 *
 * Only the stable `mutate`/`mutateAsync` functions are kept from each
 * `useMutation` result (the result object itself is new every render), so the
 * returned handlers keep their identity and the dashboard's action contexts
 * don't re-render every row on unrelated updates.
 */
export function useDashboardMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setSelectedIds = useSetAtom(selectedDomainIdsAtom);

  // Once a remove or archive succeeds, drop the domain from the selection too so it
  // doesn't come back selected if it's ever unarchived. A failed one keeps it.
  // This runs at the mutation level: per-call callbacks passed to `mutate` only
  // fire for the latest call, so a quick second action would skip the first's.
  const deselect = (id: string) =>
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const domainsFilter = trpc.tracking.listDomains.queryFilter();
  const subscriptionFilter = trpc.user.getSubscription.queryFilter();
  const subscriptionQueryKey = trpc.user.getSubscription.queryKey();

  const applyChange = async ({ ids, update, quotaDelta }: DomainChange): Promise<Snapshot> => {
    const idSet = new Set(ids);
    await queryClient.cancelQueries(domainsFilter);
    const previousDomains = queryClient.getQueriesData(domainsFilter);

    let previousSubscription: SubscriptionQuota | undefined;
    if (quotaDelta) {
      await queryClient.cancelQueries(subscriptionFilter);
      previousSubscription = queryClient.getQueryData<SubscriptionQuota>(subscriptionQueryKey);
      const delta = quotaDelta(affectedCounts(previousDomains, idSet));
      queryClient.setQueryData<SubscriptionQuota | undefined>(subscriptionQueryKey, (old) => {
        if (!old) return old;
        const activeCount = Math.max(0, old.activeCount + delta.active);
        return {
          ...old,
          activeCount,
          archivedCount: Math.max(0, old.archivedCount + delta.archived),
          canAddMore: activeCount < old.planQuota,
        };
      });
    }

    queryClient.setQueriesData(domainsFilter, (old: DomainsData) =>
      old?.flatMap((d) => (idSet.has(d.id) ? (update(d) ?? []) : [d])),
    );

    return { previousDomains, previousSubscription };
  };

  /** onMutate/onError/onSettled for a mutation whose variables map to a {@link DomainChange}. */
  const optimistic = <TVariables>(
    toChange: (variables: TVariables) => DomainChange,
    errorMessage: (err: unknown, variables: TVariables) => string,
  ) => ({
    onMutate: (variables: TVariables) => applyChange(toChange(variables)),
    onError: (err: unknown, variables: TVariables, snapshot: Snapshot | undefined) => {
      for (const [key, data] of snapshot?.previousDomains ?? []) {
        queryClient.setQueryData(key as string[], data);
      }
      if (snapshot?.previousSubscription) {
        queryClient.setQueryData(subscriptionQueryKey, snapshot.previousSubscription);
      }
      toast.error(errorMessage(err, variables));
    },
    onSettled: (_data: unknown, _err: unknown, variables: TVariables) => {
      void queryClient.invalidateQueries(domainsFilter);
      // Only changes that move the quota (remove/archive/unarchive) affect these.
      if (toChange(variables).quotaDelta) {
        void queryClient.invalidateQueries(trpc.tracking.getTrackingStatus.queryFilter());
        void queryClient.invalidateQueries(subscriptionFilter);
      }
    },
  });

  const { mutate: mutateRemove } = useMutation(
    trpc.tracking.removeDomain.mutationOptions({
      ...optimistic(
        ({ trackedDomainId }: { trackedDomainId: string }) => removeDomains([trackedDomainId]),
        () => "Failed to remove domain",
      ),
      onSuccess: (_data, { trackedDomainId }) => {
        deselect(trackedDomainId);
        toast.success("Domain removed");
      },
    }),
  );

  const { mutate: mutateArchive } = useMutation(
    trpc.tracking.archiveDomain.mutationOptions({
      ...optimistic(
        ({ trackedDomainId }: { trackedDomainId: string }) => archiveDomains([trackedDomainId]),
        () => "Failed to archive domain",
      ),
      onSuccess: (_data, { trackedDomainId }) => {
        deselect(trackedDomainId);
        toast.success("Domain archived");
      },
    }),
  );

  const { mutate: mutateUnarchive } = useMutation(
    trpc.tracking.unarchiveDomain.mutationOptions({
      ...optimistic(
        ({ trackedDomainId }: { trackedDomainId: string }) => unarchiveDomains([trackedDomainId]),
        (err) => (err instanceof Error ? err.message : "Failed to reactivate domain"),
      ),
      onSuccess: () => toast.success("Domain reactivated"),
    }),
  );

  const { mutate: mutateMute } = useMutation(
    trpc.tracking.muteDomain.mutationOptions({
      ...optimistic(
        ({ trackedDomainId, muted }: { trackedDomainId: string; muted: boolean }) =>
          muteDomains([trackedDomainId], muted),
        () => "Failed to update notification settings",
      ),
      onSuccess: (_data, { muted }) => toast.success(muted ? "Domain muted" : "Domain unmuted"),
    }),
  );

  const { mutateAsync: mutateBulkArchive, isPending: isBulkArchiving } = useMutation(
    trpc.tracking.bulkArchiveDomains.mutationOptions(
      optimistic(
        ({ trackedDomainIds }: { trackedDomainIds: string[] }) => archiveDomains(trackedDomainIds),
        () => "Failed to archive domains",
      ),
    ),
  );

  const { mutateAsync: mutateBulkRemove, isPending: isBulkDeleting } = useMutation(
    trpc.tracking.bulkRemoveDomains.mutationOptions(
      optimistic(
        ({ trackedDomainIds }: { trackedDomainIds: string[] }) => removeDomains(trackedDomainIds),
        () => "Failed to delete domains",
      ),
    ),
  );

  const { mutateAsync: mutateBulkMute, isPending: isBulkMuting } = useMutation(
    trpc.tracking.bulkMuteDomains.mutationOptions(
      optimistic(
        ({ trackedDomainIds, muted }: { trackedDomainIds: string[]; muted: boolean }) =>
          muteDomains(trackedDomainIds, muted),
        (_err, { muted }) => (muted ? "Failed to mute domains" : "Failed to unmute domains"),
      ),
    ),
  );

  return {
    remove: (trackedDomainId: string) => mutateRemove({ trackedDomainId }),
    archive: (trackedDomainId: string) => mutateArchive({ trackedDomainId }),
    unarchive: (trackedDomainId: string) => mutateUnarchive({ trackedDomainId }),
    mute: (trackedDomainId: string, muted: boolean) => mutateMute({ trackedDomainId, muted }),

    // Bulk mutations resolve with the per-domain result so callers can react to success
    bulkArchive: async (trackedDomainIds: string[]) =>
      toastBulkResult(
        "Archived",
        await mutateBulkArchive({ trackedDomainIds }),
        trackedDomainIds.length,
      ),
    bulkRemove: async (trackedDomainIds: string[]) =>
      toastBulkResult(
        "Deleted",
        await mutateBulkRemove({ trackedDomainIds }),
        trackedDomainIds.length,
      ),
    bulkMute: async (trackedDomainIds: string[], muted: boolean) =>
      toastBulkResult(
        muted ? "Muted" : "Unmuted",
        await mutateBulkMute({ trackedDomainIds, muted }),
        trackedDomainIds.length,
      ),

    isBulkArchiving,
    isBulkDeleting,
    isBulkMuting,
  };
}
