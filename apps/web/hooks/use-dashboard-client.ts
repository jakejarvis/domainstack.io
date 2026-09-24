"use client";

import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useState, useTransition } from "react";

import type { DashboardActions, DashboardBulkActions } from "@/context/dashboard-context";
import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import { useClearDashboardSelection } from "@/hooks/use-dashboard-selection";
import { useRouter } from "@/hooks/use-router";
import { useSubscription } from "@/hooks/use-subscription";
import { selectedDomainIdsAtom } from "@/lib/atoms/dashboard-atoms";
import type { ConfirmAction } from "@/lib/dashboard-utils";
import { useTRPC } from "@/lib/trpc/client";

export function useDashboardClient() {
  const router = useRouter();
  const trpc = useTRPC();
  const [isVerifyPending, startVerifyNavigation] = useTransition();
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const {
    subscription,
    isSubscriptionLoading: subscriptionLoading,
    isSubscriptionError: subscriptionError,
    refetchSubscription,
  } = useSubscription();
  const mutations = useDashboardMutations();
  const clearSelection = useClearDashboardSelection();
  const setSelectedIds = useSetAtom(selectedDomainIdsAtom);

  const [activeTab, setActiveTab] = useQueryState(
    "view",
    parseAsStringLiteral(["active", "archived"])
      .withDefault("active")
      .withOptions({ shallow: true, clearOnDefault: true }),
  );

  const domainsQuery = useQuery(trpc.tracking.listDomains.queryOptions({ includeArchived: true }));
  const allDomains = domainsQuery.data;

  const domains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt === null) ?? [],
    [allDomains],
  );
  const archivedDomains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt !== null) ?? [],
    [allDomains],
  );

  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(null);

  // Checkout returns to `?upgraded=true`. Show the banner for this visit, but drop the
  // param so a refresh or shared link doesn't show it again.
  const [upgradedParam, setUpgradedParam] = useQueryState(
    "upgraded",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(upgradedParam);
  useEffect(() => {
    if (upgradedParam) void setUpgradedParam(null);
  }, [upgradedParam, setUpgradedParam]);

  // Once a remove or archive succeeds, drop the domain from the selection too so it
  // doesn't come back selected if it's ever unarchived. A failed one keeps it.
  const deselect = (id: string) =>
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  // Bulk mutations toast their own errors; the selection only clears on success.
  const clearSelectionOnSuccess = (result: Promise<unknown>) => {
    result.then(clearSelection, () => {});
  };

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "remove") {
      const { domainId } = pendingAction;
      mutations.remove(domainId, () => deselect(domainId));
    } else if (pendingAction.type === "archive") {
      const { domainId } = pendingAction;
      mutations.archive(domainId, () => deselect(domainId));
    } else if (pendingAction.type === "bulk-archive") {
      clearSelectionOnSuccess(mutations.bulkArchive(pendingAction.domainIds));
    } else if (pendingAction.type === "bulk-delete") {
      clearSelectionOnSuccess(mutations.bulkDelete(pendingAction.domainIds));
    }
    setPendingAction(null);
  };

  const confirmSingle = (type: "remove" | "archive", id: string) => {
    const domainName = allDomains?.find((d) => d.id === id)?.domainName;
    if (domainName) setPendingAction({ type, domainId: id, domainName });
  };

  const confirmBulk = (type: "bulk-archive" | "bulk-delete", domainIds: string[]) => {
    if (domainIds.length > 0) setPendingAction({ type, domainIds, count: domainIds.length });
  };

  const actions: DashboardActions = {
    onVerify: (id, verificationMethod) => {
      const params = new URLSearchParams({ resume: "true", id });
      if (verificationMethod) params.set("method", verificationMethod);

      setVerifyingDomainId(id);
      startVerifyNavigation(() =>
        router.push(`/dashboard/add-domain?${params.toString()}`, { scroll: false }),
      );
    },
    onRemove: (id) => confirmSingle("remove", id),
    onArchive: (id) => confirmSingle("archive", id),
    onUnarchive: mutations.unarchive,
    onMute: mutations.setMuted,
    verifyingDomainId: isVerifyPending ? verifyingDomainId : null,
  };

  const bulk: DashboardBulkActions = {
    onBulkArchive: (domainIds) => confirmBulk("bulk-archive", domainIds),
    onBulkDelete: (domainIds) => confirmBulk("bulk-delete", domainIds),
    onBulkMute: (domainIds, muted) => {
      if (domainIds.length > 0) clearSelectionOnSuccess(mutations.bulkSetMuted(domainIds, muted));
    },
    isBulkArchiving: mutations.isBulkArchiving,
    isBulkDeleting: mutations.isBulkDeleting,
    isBulkMuting: mutations.isBulkMuting,
  };

  return {
    isLoading: subscriptionLoading || domainsQuery.isLoading,
    hasError: subscriptionError || domainsQuery.isError,
    handleRetry: () => {
      refetchSubscription();
      void domainsQuery.refetch();
    },
    subscription,
    showUpgradedBanner,
    setShowUpgradedBanner,
    activeTab,
    setActiveTab,
    domains,
    archivedDomains,
    actions,
    bulk,
    pendingAction,
    setPendingAction,
    handleConfirm,
  };
}
