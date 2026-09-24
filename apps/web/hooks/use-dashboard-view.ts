import { useSetAtom } from "jotai";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useDeferredValue, useEffect, useMemo } from "react";

import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { selectedDomainIdsAtom } from "@/lib/atoms/dashboard-atoms";
import {
  computeHealthStats,
  DEFAULT_SORT,
  type DashboardPageSizeOptions,
  extractAvailableProviders,
  extractAvailableTlds,
  filterDomains,
  getValidProviderIds,
  type HealthFilter,
  isPagePastEnd,
  parseSortParam,
  sortDomains,
  type StatusFilter,
  toGridSort,
  validateHealthFilters,
  validateStatusFilters,
} from "@/lib/dashboard-utils";
import {
  useDashboardPageSize,
  useDashboardViewMode,
  usePreferencesStore,
} from "@/lib/stores/preferences-store";
import type { TrackedDomainWithDetails } from "@domainstack/types";

const dashboardParams = {
  search: parseAsString.withDefault(""),
  status: parseAsArrayOf(parseAsString).withDefault([]),
  health: parseAsArrayOf(parseAsString).withDefault([]),
  tlds: parseAsArrayOf(parseAsString).withDefault([]),
  providers: parseAsArrayOf(parseAsString).withDefault([]),
  domainId: parseAsString,
  sort: parseAsString.withDefault(DEFAULT_SORT),
  // 1-based in the URL, 0-based for TanStack Table
  page: parseAsInteger.withDefault(1),
};

type FilterPatch = { search?: string | null } & Partial<
  Record<"status" | "health" | "tlds" | "providers", string[] | null>
>;

export type DashboardView = ReturnType<typeof useDashboardViewState>;

/**
 * All dashboard view state: filters, sort, and page live in the URL; page size
 * and view mode in preferences. Returns the filtered, sorted domains for both
 * the grid and the table.
 *
 * Any filter or sort change returns to page 1 and clears the selection in the
 * same update, so nothing has to watch for changes after the fact.
 */
export function useDashboardViewState(domains: TrackedDomainWithDetails[]) {
  const now = useHydratedNow();
  const viewMode = useDashboardViewMode();
  const pageSize = useDashboardPageSize();
  const setPageSizePreference = usePreferencesStore((s) => s.setPageSize);
  const setSelectedIds = useSetAtom(selectedDomainIdsAtom);

  const [params, setParams] = useQueryStates(dashboardParams, {
    shallow: true,
    clearOnDefault: true,
  });

  // The input shows `params.search` immediately; filtering can lag behind a keystroke.
  const deferredSearch = useDeferredValue(params.search);
  const status = useMemo(() => validateStatusFilters(params.status), [params.status]);
  const health = useMemo(() => validateHealthFilters(params.health), [params.health]);
  const { domainId } = params;

  const availableTlds = useMemo(() => extractAvailableTlds(domains), [domains]);
  const availableProviders = useMemo(() => extractAvailableProviders(domains), [domains]);
  const validProviderIds = useMemo(
    () => getValidProviderIds(availableProviders),
    [availableProviders],
  );
  // Hand-edited or stale URLs may name TLDs/providers the user doesn't have; ignore those
  // so they don't count as active filters or render as chips.
  const tlds = useMemo(
    () => params.tlds.filter((t) => availableTlds.includes(t)),
    [params.tlds, availableTlds],
  );
  const providers = useMemo(
    () => params.providers.filter((p) => validProviderIds.has(p)),
    [params.providers, validProviderIds],
  );

  const sort = viewMode === "grid" ? toGridSort(params.sort) : params.sort;
  const sorting = useMemo(() => parseSortParam(sort), [sort]);

  const visibleDomains = useMemo(() => {
    if (!now) return domains;
    const criteria = { search: deferredSearch, status, health, tlds, providers, domainId };
    const filtered = filterDomains(domains, criteria, validProviderIds, now);
    return sortDomains(filtered, sort, now);
  }, [
    domains,
    deferredSearch,
    status,
    health,
    tlds,
    providers,
    domainId,
    validProviderIds,
    sort,
    now,
  ]);

  const stats = useMemo(
    () => (now ? computeHealthStats(domains, now) : { expiringSoon: 0, pendingVerification: 0 }),
    [domains, now],
  );

  // A deep-linked page past the end shows page 1 instead of an empty table, and the
  // URL follows so it never names a page that isn't shown.
  const requestedPageIndex = Math.max(0, params.page - 1);
  const isPastEnd = isPagePastEnd(visibleDomains.length, requestedPageIndex, pageSize);
  const pageIndex = isPastEnd ? 0 : requestedPageIndex;
  useEffect(() => {
    if (isPastEnd) void setParams({ page: null });
  }, [isPastEnd, setParams]);

  const actions = useMemo(() => {
    const updateFilters = (patch: FilterPatch) => {
      void setParams({ ...patch, domainId: null, page: null });
      setSelectedIds(new Set());
    };
    const listOrNull = <T extends string>(values: T[]) => (values.length > 0 ? values : null);

    return {
      setSearch: (value: string) => updateFilters({ search: value || null }),
      setStatus: (values: StatusFilter[]) => updateFilters({ status: listOrNull(values) }),
      setHealth: (values: HealthFilter[]) => updateFilters({ health: listOrNull(values) }),
      setTlds: (values: string[]) => updateFilters({ tlds: listOrNull(values) }),
      setProviders: (values: string[]) => updateFilters({ providers: listOrNull(values) }),
      applyHealthFilter: (filter: HealthFilter | "pending") =>
        updateFilters(
          filter === "pending"
            ? { status: ["pending"], health: null }
            : { status: null, health: [filter] },
        ),
      clearDomainId: () => updateFilters({}),
      clearFilters: () =>
        updateFilters({ search: null, status: null, health: null, tlds: null, providers: null }),
      setSort: (value: string) => void setParams({ sort: value, page: null }),
      setPageIndex: (index: number) => void setParams({ page: index + 1 }),
      setPageSize: (size: DashboardPageSizeOptions) => {
        setPageSizePreference(size);
        void setParams({ page: null });
      },
    };
  }, [setParams, setSelectedIds, setPageSizePreference]);

  const filteredDomainName = domainId
    ? (domains.find((d) => d.id === domainId)?.domainName ?? null)
    : null;

  const hasActiveFilters =
    params.search.length > 0 ||
    status.length > 0 ||
    health.length > 0 ||
    tlds.length > 0 ||
    providers.length > 0 ||
    domainId !== null;

  return {
    search: params.search,
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
    sort,
    sorting,
    pageIndex,
    pageSize,
    /** Filtered and sorted; the table paginates this, the grid shows all of it. */
    visibleDomains,
    ...actions,
  };
}
