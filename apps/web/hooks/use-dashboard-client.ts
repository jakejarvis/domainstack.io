"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import { useDashboardMutations } from "@/hooks/use-dashboard-mutations";
import {
  getDashboardFilterSignature,
  useDashboardPagination,
  useSyncDashboardPage,
} from "@/hooks/use-dashboard-pagination";
import {
  useClearDashboardSelection,
  useSyncVisibleDomainIds,
} from "@/hooks/use-dashboard-selection";
import { useRouter } from "@/hooks/use-router";
import { useSubscription } from "@/hooks/use-subscription";
import {
  type ConfirmAction,
  DEFAULT_SORT,
  SORT_OPTIONS,
  type SortOption,
  sortDomains,
} from "@/lib/dashboard-utils";
import { useDashboardViewMode } from "@/lib/stores/preferences-store";
import { useTRPC } from "@/lib/trpc/client";
import { useSession } from "@domainstack/auth/client";
import type { VerificationMethod } from "@domainstack/types";

export function useDashboardClient() {
  const { data: session, isPending: isSessionPending } = useSession();
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

  const [activeTab, setActiveTab] = useQueryState(
    "view",
    parseAsStringLiteral(["active", "archived"])
      .withDefault("active")
      .withOptions({ shallow: true, clearOnDefault: true }),
  );
  const viewMode = useDashboardViewMode();

  const [sortParam, setSortParam] = useQueryState(
    "sort",
    parseAsString.withDefault(DEFAULT_SORT).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );
  const sortOption = SORT_OPTIONS.some((opt) => opt.value === sortParam)
    ? (sortParam as SortOption)
    : DEFAULT_SORT;
  const setSortOption = setSortParam;

  const paginationHook = useDashboardPagination();
  const {
    state: pagination,
    actions: { resetPage },
  } = paginationHook;

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

  const filterHook = useDashboardFilters(domains);
  const { filteredDomains: filteredUnsorted } = filterHook.state;

  const filteredDomains = useMemo(
    () => (viewMode === "grid" ? sortDomains(filteredUnsorted, sortOption) : filteredUnsorted),
    [filteredUnsorted, sortOption, viewMode],
  );

  const filteredDomainIds = useMemo(() => filteredDomains.map((d) => d.id), [filteredDomains]);
  useSyncVisibleDomainIds(filteredDomainIds);
  useSyncDashboardPage({
    itemCount: filteredDomains.length,
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    filterSignature: getDashboardFilterSignature(filterHook.state),
    resetPage,
    enabled: allDomains !== undefined,
  });

  const clearSelection = useClearDashboardSelection();

  const doBulkArchive = useCallback(
    async (domainIds: string[]) => {
      try {
        await mutations.bulkArchive(domainIds);
        clearSelection();
      } catch {
        // Error handled in mutation onError
      }
    },
    [mutations, clearSelection],
  );

  const doBulkDelete = useCallback(
    async (domainIds: string[]) => {
      try {
        await mutations.bulkDelete(domainIds);
        clearSelection();
      } catch {
        // Error handled in mutation onError
      }
    },
    [mutations, clearSelection],
  );

  const doBulkMute = useCallback(
    async (domainIds: string[], muted: boolean) => {
      try {
        await mutations.bulkSetMuted(domainIds, muted);
        clearSelection();
      } catch {
        // Error handled in mutation onError
      }
    },
    [mutations, clearSelection],
  );

  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(null);
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;
    if (pendingAction.type === "remove") {
      mutations.remove(pendingAction.domainId);
    } else if (pendingAction.type === "archive") {
      mutations.archive(pendingAction.domainId);
    } else if (pendingAction.type === "bulk-archive") {
      void doBulkArchive(pendingAction.domainIds);
    } else if (pendingAction.type === "bulk-delete") {
      void doBulkDelete(pendingAction.domainIds);
    }
    setPendingAction(null);
  }, [pendingAction, mutations, doBulkArchive, doBulkDelete]);

  const searchParams = useSearchParams();
  const upgradedParam = searchParams?.get("upgraded") === "true";
  if (upgradedParam && !showUpgradedBanner) {
    setShowUpgradedBanner(true);
  }
  useEffect(() => {
    if (!upgradedParam || !searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("upgraded");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
    router.replace(newUrl, { scroll: false });
  }, [upgradedParam, router, searchParams]);

  const handleVerify = useCallback(
    (id: string, verificationMethod: VerificationMethod | null) => {
      const params = new URLSearchParams({
        resume: "true",
        id,
      });

      if (verificationMethod) {
        params.set("method", verificationMethod);
      }

      setVerifyingDomainId(id);
      startVerifyNavigation(() =>
        router.push(`/dashboard/add-domain?${params.toString()}`, {
          scroll: false,
        }),
      );
    },
    [router, startVerifyNavigation],
  );

  const domainNameById = useCallback(
    (id: string) => allDomains?.find((d) => d.id === id)?.domainName,
    [allDomains],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const domainName = domainNameById(id);
      if (!domainName) return;
      setPendingAction({ type: "remove", domainId: id, domainName });
    },
    [domainNameById],
  );

  const handleArchive = useCallback(
    (id: string) => {
      const domainName = domainNameById(id);
      if (!domainName) return;
      setPendingAction({ type: "archive", domainId: id, domainName });
    },
    [domainNameById],
  );

  const handleBulkArchive = useCallback((domainIds: string[]) => {
    if (domainIds.length === 0) return;
    setPendingAction({
      type: "bulk-archive",
      domainIds,
      count: domainIds.length,
    });
  }, []);

  const handleBulkDelete = useCallback((domainIds: string[]) => {
    if (domainIds.length === 0) return;
    setPendingAction({
      type: "bulk-delete",
      domainIds,
      count: domainIds.length,
    });
  }, []);

  const handleBulkMute = useCallback(
    (domainIds: string[], muted: boolean) => {
      if (domainIds.length === 0) return;
      void doBulkMute(domainIds, muted);
    },
    [doBulkMute],
  );

  const handleUnarchive = useCallback(
    (id: string) => {
      mutations.unarchive(id);
    },
    [mutations],
  );

  const handleMute = useCallback(
    (id: string, muted: boolean) => {
      mutations.setMuted(id, muted);
    },
    [mutations],
  );

  const isLoading = subscriptionLoading || domainsQuery.isLoading || isSessionPending;
  const hasError = subscriptionError || domainsQuery.isError;

  const handleRetry = useCallback(() => {
    refetchSubscription();
    void domainsQuery.refetch();
  }, [refetchSubscription, domainsQuery]);

  return {
    session,
    isLoading,
    hasError,
    handleRetry,
    subscription,
    showUpgradedBanner,
    setShowUpgradedBanner,
    activeTab,
    setActiveTab,
    domains,
    archivedDomains,
    filteredDomains,
    handleVerify,
    handleRemove,
    handleArchive,
    handleUnarchive,
    handleMute,
    verifyingDomainId: isVerifyPending ? verifyingDomainId : null,
    handleBulkArchive,
    handleBulkDelete,
    handleBulkMute,
    mutations,
    filterHook,
    sortOption,
    setSortOption,
    paginationHook,
    pendingAction,
    setPendingAction,
    handleConfirm,
  };
}
