"use client";

import {
  IconArchive,
  IconArrowLeft,
  IconHeartHandshake,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Table } from "@tanstack/react-table";
import { usePathname, useSearchParams } from "next/navigation";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { ArchivedDomainsList } from "@/components/dashboard/archived-domains-list";
import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { HealthSummary } from "@/components/dashboard/health-summary";
import { SubscriptionEndingBanner } from "@/components/dashboard/subscription-ending-banner";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DashboardProvider } from "@/context/dashboard-context";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { useRouter } from "@/hooks/use-router";
import { useSubscription } from "@/hooks/use-subscription";
import { useSession } from "@/lib/auth-client";
import type { VerificationMethod } from "@/lib/constants/verification";
import {
  type ConfirmAction,
  computeHealthStats,
  DEFAULT_SORT,
  type DomainFilterCriteria,
  extractAvailableProviders,
  extractAvailableTlds,
  filterDomains,
  getConfirmDialogContent,
  getValidProviderIds,
  type HealthFilter,
  SORT_OPTIONS,
  type SortOption,
  type StatusFilter,
  sortDomains,
  validateHealthFilters,
  validateStatusFilters,
} from "@/lib/dashboard-utils";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { useTRPC } from "@/lib/trpc/client";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";

export function DashboardClient() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    subscription,
    isSubscriptionLoading: subscriptionLoading,
    isSubscriptionError: subscriptionError,
    refetchSubscription,
  } = useSubscription();

  const [activeTab, setActiveTab] = useQueryState(
    "view",
    parseAsStringLiteral(["active", "archived"])
      .withDefault("active")
      .withOptions({ shallow: true, clearOnDefault: true }),
  );
  const viewMode = usePreferencesStore((s) => s.viewMode);

  // Grid sort state with URL persistence
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

  // Pagination state (URL-synced page index, localStorage-synced page size)
  const [pageParam, setPageParam] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );
  const pageSize = usePreferencesStore((s) => s.pageSize);
  const setPageSizePreference = usePreferencesStore((s) => s.setPageSize);
  const pageIndex = Math.max(0, pageParam - 1);
  const pagination = { pageIndex, pageSize };
  const setPageIndex = useCallback(
    (newIndex: number) => {
      setPageParam(newIndex + 1);
    },
    [setPageParam],
  );
  const setPageSize = useCallback(
    (newSize: typeof pageSize) => {
      setPageSizePreference(newSize);
      setPageParam(1);
    },
    [setPageSizePreference, setPageParam],
  );
  const resetPage = useCallback(() => {
    setPageParam(1);
  }, [setPageParam]);

  const snapshot = useDashboardStore((s) => s.snapshot);
  const captureSnapshot = useDashboardStore((s) => s.captureSnapshot);
  const clearSnapshot = useDashboardStore((s) => s.clearSnapshot);
  const [tableInstance, setTableInstance] =
    useState<Table<TrackedDomainWithDetails> | null>(null);

  // Tracked domains query + mutations
  const domainsQueryKey = trpc.tracking.listDomains.queryKey();
  const subscriptionQueryKey = trpc.user.getSubscription.queryKey();

  const domainsQuery = useQuery(
    trpc.tracking.listDomains.queryOptions({ includeArchived: true }),
  );
  const allDomains = domainsQuery.data;

  const invalidateDomainQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
    void queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
  }, [queryClient, domainsQueryKey, subscriptionQueryKey]);

  const removeMutation = useMutation({
    ...trpc.tracking.removeDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData(subscriptionQueryKey);

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: typeof allDomains) =>
          old?.filter((d) => d.id !== trackedDomainId),
      );
      queryClient.setQueryData(
        subscriptionQueryKey,
        (old: typeof subscription) => {
          if (!old) return old;
          const newActiveCount = Math.max(0, old.activeCount - 1);
          return {
            ...old,
            activeCount: newActiveCount,
            canAddMore: newActiveCount < old.planQuota,
          };
        },
      );

      return { previousDomains, previousSubscription };
    },
    onError: (_err, _vars, context) => {
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
      toast.error("Failed to remove domain");
    },
    onSuccess: () => toast.success("Domain removed"),
    onSettled: invalidateDomainQueries,
  });

  const archiveMutation = useMutation({
    ...trpc.tracking.archiveDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData(subscriptionQueryKey);

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: typeof allDomains) =>
          old?.map((d) =>
            d.id === trackedDomainId ? { ...d, archivedAt: new Date() } : d,
          ),
      );
      queryClient.setQueryData(
        subscriptionQueryKey,
        (old: typeof subscription) => {
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

      return { previousDomains, previousSubscription };
    },
    onError: (_err, _vars, context) => {
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
      toast.error("Failed to archive domain");
    },
    onSuccess: () => toast.success("Domain archived"),
    onSettled: invalidateDomainQueries,
  });

  const unarchiveMutation = useMutation({
    ...trpc.tracking.unarchiveDomain.mutationOptions(),
    onMutate: async ({ trackedDomainId }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData(subscriptionQueryKey);

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: typeof allDomains) =>
          old?.map((d) =>
            d.id === trackedDomainId ? { ...d, archivedAt: null } : d,
          ),
      );
      queryClient.setQueryData(
        subscriptionQueryKey,
        (old: typeof subscription) => {
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

      return { previousDomains, previousSubscription };
    },
    onError: (err, _vars, context) => {
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
      toast.error(
        err instanceof Error ? err.message : "Failed to reactivate domain",
      );
    },
    onSuccess: () => toast.success("Domain reactivated"),
    onSettled: invalidateDomainQueries,
  });

  const muteMutation = useMutation({
    ...trpc.user.setDomainMuted.mutationOptions(),
    onMutate: async ({ trackedDomainId, muted }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: typeof allDomains) =>
          old?.map((d) => (d.id === trackedDomainId ? { ...d, muted } : d)),
      );

      return { previousDomains };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousDomains) {
        for (const [key, data] of context.previousDomains) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error("Failed to update notification settings");
    },
    onSuccess: (_data, { muted }) =>
      toast.success(muted ? "Domain muted" : "Domain unmuted"),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: domainsQueryKey }),
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: trpc.tracking.bulkArchiveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData(subscriptionQueryKey);

      const idsSet = new Set(trackedDomainIds);
      let archiveCount = 0;
      for (const [, domains] of previousDomains) {
        if (!domains) continue;
        for (const d of domains as NonNullable<typeof allDomains>) {
          if (idsSet.has(d.id) && !d.archivedAt) archiveCount++;
        }
      }

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: typeof allDomains) =>
          old?.map((d) =>
            idsSet.has(d.id) ? { ...d, archivedAt: new Date() } : d,
          ),
      );
      queryClient.setQueryData(
        subscriptionQueryKey,
        (old: typeof subscription) => {
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

      return { previousDomains, previousSubscription };
    },
    onError: (_err, _vars, context) => {
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
      toast.error("Failed to archive domains");
    },
    onSettled: invalidateDomainQueries,
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: trpc.tracking.bulkRemoveDomains.mutationOptions().mutationFn,
    onMutate: async ({ trackedDomainIds }) => {
      await queryClient.cancelQueries({ queryKey: domainsQueryKey });
      await queryClient.cancelQueries({ queryKey: subscriptionQueryKey });

      const previousDomains = queryClient.getQueriesData({
        queryKey: domainsQueryKey,
      });
      const previousSubscription =
        queryClient.getQueryData(subscriptionQueryKey);

      const idsSet = new Set(trackedDomainIds);
      let deleteCount = 0;
      for (const [, domains] of previousDomains) {
        if (!domains) continue;
        for (const d of domains as NonNullable<typeof allDomains>) {
          if (idsSet.has(d.id) && !d.archivedAt) deleteCount++;
        }
      }

      queryClient.setQueriesData(
        { queryKey: domainsQueryKey },
        (old: typeof allDomains) => old?.filter((d) => !idsSet.has(d.id)),
      );
      queryClient.setQueryData(
        subscriptionQueryKey,
        (old: typeof subscription) => {
          if (!old) return old;
          const newActiveCount = Math.max(0, old.activeCount - deleteCount);
          return {
            ...old,
            activeCount: newActiveCount,
            canAddMore: newActiveCount < old.planQuota,
          };
        },
      );

      return { previousDomains, previousSubscription };
    },
    onError: (_err, _vars, context) => {
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
      toast.error("Failed to delete domains");
    },
    onSettled: invalidateDomainQueries,
  });

  const domains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt === null) ?? [],
    [allDomains],
  );
  const archivedDomains = useMemo(
    () => allDomains?.filter((d) => d.archivedAt !== null) ?? [],
    [allDomains],
  );

  const [, startTransition] = useTransition();

  // -------------------------------------------------------------------------
  // Filter State (inlined from useDashboardFilters hook)
  // -------------------------------------------------------------------------

  // Use shared hydrated time to avoid extra re-renders
  const now = useHydratedNow();

  // URL state with nuqs
  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString.withDefault(""),
      status: parseAsArrayOf(parseAsString).withDefault([]),
      health: parseAsArrayOf(parseAsString).withDefault([]),
      tlds: parseAsArrayOf(parseAsString).withDefault([]),
      providers: parseAsArrayOf(parseAsString).withDefault([]),
      domainId: parseAsString,
    },
    {
      shallow: true,
      clearOnDefault: true,
    },
  );

  // Validate status and health filter values from URL params
  const validatedStatus = useMemo(
    () => validateStatusFilters(filters.status),
    [filters.status],
  );

  const validatedHealth = useMemo(
    () => validateHealthFilters(filters.health),
    [filters.health],
  );

  // Extract unique TLDs from domains for the dropdown
  const availableTlds = useMemo(() => extractAvailableTlds(domains), [domains]);

  // Extract unique providers from domains, grouped by category
  const availableProviders = useMemo(
    () => extractAvailableProviders(domains),
    [domains],
  );

  // Create a flat set of all valid provider IDs for validation
  const validProviderIds = useMemo(
    () => getValidProviderIds(availableProviders),
    [availableProviders],
  );

  // Check if any filters are active
  const hasActiveFilters =
    filters.search.length > 0 ||
    validatedStatus.length > 0 ||
    validatedHealth.length > 0 ||
    filters.tlds.length > 0 ||
    filters.providers.length > 0 ||
    !!filters.domainId;

  // Filter domains based on current filters
  const filterCriteria: DomainFilterCriteria = useMemo(
    () => ({
      search: filters.search,
      domainId: filters.domainId,
      status: validatedStatus,
      health: validatedHealth,
      tlds: filters.tlds,
      providers: filters.providers,
    }),
    [filters, validatedStatus, validatedHealth],
  );

  const filteredUnsorted = useMemo(
    () =>
      now
        ? filterDomains(domains, filterCriteria, validProviderIds, now)
        : domains,
    [domains, filterCriteria, validProviderIds, now],
  );

  // Compute stats for health summary
  const stats = useMemo(
    () =>
      now
        ? computeHealthStats(domains, now)
        : { expiringSoon: 0, pendingVerification: 0 },
    [domains, now],
  );

  // Filter setters - wrapped with startTransition for non-blocking updates
  const setSearchImmediate = useCallback(
    (value: string) => {
      setFilters({ search: value || null, domainId: null });
    },
    [setFilters],
  );
  const setSearch = useCallback(
    (value: string) => startTransition(() => setSearchImmediate(value)),
    [setSearchImmediate],
  );

  const setStatusImmediate = useCallback(
    (values: StatusFilter[]) => {
      setFilters({ status: values.length > 0 ? values : null, domainId: null });
    },
    [setFilters],
  );
  const setStatus = useCallback(
    (value: StatusFilter[]) => startTransition(() => setStatusImmediate(value)),
    [setStatusImmediate],
  );

  const setHealthImmediate = useCallback(
    (values: HealthFilter[]) => {
      setFilters({ health: values.length > 0 ? values : null, domainId: null });
    },
    [setFilters],
  );
  const setHealth = useCallback(
    (value: HealthFilter[]) => startTransition(() => setHealthImmediate(value)),
    [setHealthImmediate],
  );

  const setTldsImmediate = useCallback(
    (values: string[]) => {
      setFilters({ tlds: values.length > 0 ? values : null, domainId: null });
    },
    [setFilters],
  );
  const setTlds = useCallback(
    (value: string[]) => startTransition(() => setTldsImmediate(value)),
    [setTldsImmediate],
  );

  const setProvidersImmediate = useCallback(
    (values: string[]) => {
      setFilters({
        providers: values.length > 0 ? values : null,
        domainId: null,
      });
    },
    [setFilters],
  );
  const setProviders = useCallback(
    (value: string[]) => startTransition(() => setProvidersImmediate(value)),
    [setProvidersImmediate],
  );

  const clearFilters = useCallback(() => {
    setFilters({
      search: null,
      status: null,
      health: null,
      tlds: null,
      providers: null,
      domainId: null,
    });
  }, [setFilters]);

  const applyHealthFilter = useCallback(
    (filter: HealthFilter | "pending") => {
      if (filter === "pending") {
        setFilters({ status: ["pending"], health: null, domainId: null });
      } else {
        setFilters({ status: null, health: [filter], domainId: null });
      }
    },
    [setFilters],
  );

  const clearDomainId = useCallback(() => {
    setFilters({ domainId: null });
  }, [setFilters]);

  const filteredDomainName = filters.domainId
    ? (domains.find((d) => d.id === filters.domainId)?.domainName ?? null)
    : null;

  // Expose filter values using the variable names expected by snapshot logic
  const { search, tlds, providers, domainId } = filters;
  const status = validatedStatus;
  const health = validatedHealth;

  // Track previous pathname to detect navigation away from/to dashboard
  const prevPathnameRef = useRef(pathname);

  // Effect event to restore snapshot - reads latest snapshot without being a dependency
  const onRestoreSnapshot = useEffectEvent(() => {
    if (!snapshot) return;
    setSearchImmediate(snapshot.search);
    setStatusImmediate(snapshot.status);
    setHealthImmediate(snapshot.health);
    setTldsImmediate(snapshot.tlds);
    setProvidersImmediate(snapshot.providers);
    setSortOption(snapshot.sort);
    setPageIndex(snapshot.page);
    if (snapshot.view !== "active") {
      setActiveTab(snapshot.view);
    }
    clearSnapshot();
  });

  // Effect event to capture snapshot - reads latest filter values without them being dependencies
  const onCaptureSnapshot = useEffectEvent(() => {
    captureSnapshot({
      search,
      status,
      health,
      tlds,
      providers,
      domainId,
      sort: sortOption,
      page: pagination.pageIndex,
      view: activeTab ?? "active",
    });
  });

  // Restore snapshot when returning to /dashboard from an intercepted route
  // Note: useLayoutEffect runs before useEffect, so we can restore before the capture check
  useLayoutEffect(() => {
    const wasOnDashboard = prevPathnameRef.current === "/dashboard";
    const isOnDashboard = pathname === "/dashboard";

    if (!wasOnDashboard && isOnDashboard) {
      onRestoreSnapshot();
    }
  }, [pathname]);

  // Capture snapshot when navigating away from /dashboard
  // For intercepted routes (modals), this component stays mounted and the snapshot is preserved
  // For full navigations, the unmount cleanup below will clear it
  useEffect(() => {
    const wasOnDashboard = prevPathnameRef.current === "/dashboard";
    const isOnDashboard = pathname === "/dashboard";

    if (wasOnDashboard && !isOnDashboard) {
      onCaptureSnapshot();
    }

    // Update ref after both effects have read the previous value
    prevPathnameRef.current = pathname;
  }, [pathname]);

  // Clear snapshot on unmount (full navigation away, not intercepted route)
  // This prevents stale snapshots from being restored if user navigates
  // to a different page entirely and then comes back to dashboard
  useEffect(() => clearSnapshot, [clearSnapshot]);

  // Apply sorting after filtering (only for grid view - table has its own column sorting)
  const filteredDomains = useMemo(
    () =>
      viewMode === "grid"
        ? sortDomains(filteredUnsorted, sortOption)
        : filteredUnsorted,
    [filteredUnsorted, sortOption, viewMode],
  );

  // Filtered domain IDs for selection context
  const filteredDomainIds = useMemo(
    () => filteredDomains.map((d) => d.id),
    [filteredDomains],
  );

  // Ref to hold clearSelection callback from provider (set after provider mounts)
  const clearSelectionRef = useRef<(() => void) | null>(null);

  const doBulkArchive = useCallback(
    async (domainIds: string[]) => {
      try {
        const result = await bulkArchiveMutation.mutateAsync({
          trackedDomainIds: domainIds,
        });
        clearSelectionRef.current?.();
        if (result.failedCount === 0) {
          toast.success(
            `Archived ${result.successCount} domain${result.successCount === 1 ? "" : "s"}`,
          );
        } else {
          toast.warning(
            `Archived ${result.successCount} of ${domainIds.length} domains (${result.failedCount} failed)`,
          );
        }
      } catch {
        // Error handled in mutation onError
      }
    },
    [bulkArchiveMutation],
  );

  const doBulkDelete = useCallback(
    async (domainIds: string[]) => {
      try {
        const result = await bulkDeleteMutation.mutateAsync({
          trackedDomainIds: domainIds,
        });
        clearSelectionRef.current?.();
        if (result.failedCount === 0) {
          toast.success(
            `Deleted ${result.successCount} domain${result.successCount === 1 ? "" : "s"}`,
          );
        } else {
          toast.warning(
            `Deleted ${result.successCount} of ${domainIds.length} domains (${result.failedCount} failed)`,
          );
        }
      } catch {
        // Error handled in mutation onError
      }
    },
    [bulkDeleteMutation],
  );

  // Confirmation dialog - local state
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(
    null,
  );

  // Upgrade banner - local state
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return;
    if (pendingAction.type === "remove") {
      removeMutation.mutate({ trackedDomainId: pendingAction.domainId });
    } else if (pendingAction.type === "archive") {
      archiveMutation.mutate({ trackedDomainId: pendingAction.domainId });
    } else if (pendingAction.type === "bulk-archive") {
      void doBulkArchive(pendingAction.domainIds);
    } else if (pendingAction.type === "bulk-delete") {
      void doBulkDelete(pendingAction.domainIds);
    }
    setPendingAction(null);
  }, [
    pendingAction,
    removeMutation,
    archiveMutation,
    doBulkArchive,
    doBulkDelete,
  ]);

  // Handle ?upgraded=true query param (after nuqs adapter)
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("upgraded") === "true") {
      setShowUpgradedBanner(true);
      // Clear only the `upgraded` param while preserving others (e.g., filters)
      const params = new URLSearchParams(searchParams.toString());
      params.delete("upgraded");
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname + (newSearch ? `?${newSearch}` : "");
      router.replace(newUrl, { scroll: false });
    }
  }, [router, searchParams]);

  const handleAddDomain = useCallback(() => {
    router.push("/dashboard/add-domain", { scroll: false });
  }, [router]);

  const handleVerify = useCallback(
    (id: string, verificationMethod: VerificationMethod | null) => {
      const params = new URLSearchParams({
        resume: "true",
        id,
      });

      if (verificationMethod) {
        params.set("method", verificationMethod);
      }

      router.push(`/dashboard/add-domain?${params.toString()}`, {
        scroll: false,
      });
    },
    [router],
  );

  const handleRemove = useCallback((id: string, domainName: string) => {
    setPendingAction({ type: "remove", domainId: id, domainName });
  }, []);

  const handleArchive = useCallback((id: string, domainName: string) => {
    setPendingAction({ type: "archive", domainId: id, domainName });
  }, []);

  // Bulk action handlers - receive domainIds from context
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

  const handleUnarchive = useCallback(
    (id: string) => {
      unarchiveMutation.mutate({ trackedDomainId: id });
    },
    [unarchiveMutation],
  );

  const handleToggleMuted = useCallback(
    (id: string, muted: boolean) => {
      muteMutation.mutate({ trackedDomainId: id, muted });
    },
    [muteMutation],
  );

  // Show loading until we have both query data AND session data
  const isLoading =
    subscriptionLoading || domainsQuery.isLoading || sessionLoading || !session;

  const hasError = subscriptionError || domainsQuery.isError;

  const handleRetry = useCallback(() => {
    refetchSubscription();
    domainsQuery.refetch();
  }, [refetchSubscription, domainsQuery]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (hasError) {
    return <DashboardError onRetry={handleRetry} />;
  }

  // Build filter state/actions for context
  const filterState = {
    search,
    status,
    health,
    tlds,
    providers,
    domainId,
    filteredDomainName,
    availableTlds,
    availableProviders,
    hasActiveFilters,
    stats,
    sortOption,
    table: viewMode === "table" ? tableInstance : null,
  };

  const filterActions = {
    setSearch,
    setStatus,
    setHealth,
    setTlds,
    setProviders,
    clearFilters,
    applyHealthFilter,
    clearDomainId,
    setSortOption,
    setTable: setTableInstance,
  };

  return (
    <div className="space-y-6">
      <DashboardHeader userName={session?.user?.name ?? ""} />

      {/* Pro upgrade success banner */}
      {showUpgradedBanner && (
        <DashboardBannerDismissable
          variant="success"
          icon={IconHeartHandshake}
          title="Welcome to Pro!"
          description={`You now have access to track up to ${subscription?.planQuota} domains. Thank you for upgrading!`}
          dismissible
          onDismiss={() => setShowUpgradedBanner(false)}
        />
      )}

      {/* Subscription ending banner for users who canceled */}
      <SubscriptionEndingBanner />

      {/* Upgrade prompt when free user is near or at limit */}
      <UpgradeBanner />

      <DashboardProvider
        domainIds={filteredDomainIds}
        onVerify={handleVerify}
        onRemove={handleRemove}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onToggleMuted={handleToggleMuted}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
        isBulkArchiving={bulkArchiveMutation.isPending}
        isBulkDeleting={bulkDeleteMutation.isPending}
        filterState={filterState}
        filterActions={filterActions}
        paginationState={pagination}
        paginationActions={{ setPageIndex, setPageSize, resetPage }}
      >
        {/* Active domains view */}
        {activeTab === "active" && (
          <div className="space-y-4">
            {/* Health summary - only show when there are domains */}
            {domains.length > 0 && <HealthSummary />}

            {/* Filters - only show when there are domains */}
            {domains.length > 0 && <DashboardFilters />}

            <DashboardContent
              domains={filteredDomains}
              totalDomains={domains.length}
              onAddDomain={handleAddDomain}
              onTableReady={setTableInstance}
              clearSelectionRef={clearSelectionRef}
            />

            {/* Link to archived domains - only show when there are archived domains */}
            {subscription?.archivedCount && subscription.archivedCount > 0 ? (
              <div className="pt-4 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab("archived")}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <IconArchive />
                  View {subscription?.archivedCount} archived domain
                  {subscription?.archivedCount !== 1 && "s"}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {/* Archived domains view */}
        {activeTab === "archived" && (
          <div className="space-y-4">
            {/* Back to active domains */}
            <Button
              variant="ghost"
              onClick={() => setActiveTab("active")}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <IconArrowLeft />
              Back to domains
            </Button>

            <ArchivedDomainsList domains={archivedDomains} />
          </div>
        )}
      </DashboardProvider>

      {/* Confirmation dialog for destructive actions */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        {pendingAction && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {getConfirmDialogContent(pendingAction).title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {getConfirmDialogContent(pendingAction).description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                variant={getConfirmDialogContent(pendingAction).variant}
              >
                {getConfirmDialogContent(pendingAction).confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
