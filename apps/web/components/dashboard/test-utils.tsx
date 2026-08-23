import { parseAsString, useQueryState } from "nuqs";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useMemo, useState } from "react";
import { vi } from "vitest";

import { ArchivedDomainsList } from "@/components/dashboard/archived-domains-list";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { HealthSummary } from "@/components/dashboard/health-summary";
import { mockSubscription } from "@/components/dashboard/mocks/subscription";
import { DashboardProvider } from "@/context/dashboard-context";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import {
  getDashboardFilterSignature,
  useDashboardPagination,
  useSyncDashboardPage,
} from "@/hooks/use-dashboard-pagination";
import { useSyncVisibleDomainIds } from "@/hooks/use-dashboard-selection";
import type { DashboardTable } from "@/lib/dashboard-table-features";
import { DEFAULT_SORT, SORT_OPTIONS, type SortOption, sortDomains } from "@/lib/dashboard-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { render } from "@/mocks/react";
import type { TrackedDomainWithDetails } from "@domainstack/types";

import { DASHBOARD_TEST_NOW, makeDashboardDomains } from "./test-fixtures";

export { createInitialDelays, pruneDelays } from "@/components/dashboard/dashboard-grid";
export { mockSubscription } from "@/components/dashboard/mocks/subscription";

export const dashboardActionSpies = {
  onVerify: vi.fn<(id: string, method: string | null) => void>(),
  onRemove: vi.fn<(id: string, domainName: string) => void>(),
  onArchive: vi.fn<(id: string, domainName: string) => void>(),
  onUnarchive: vi.fn<(id: string) => void>(),
  onToggleMuted: vi.fn<(id: string, muted: boolean) => void>(),
  onBulkArchive: vi.fn<(domainIds: string[]) => void>(),
  onBulkDelete: vi.fn<(domainIds: string[]) => void>(),
};

const emptyProviders = {
  registrar: [],
  dns: [],
  hosting: [],
  email: [],
  ca: [],
};

function stubFilterHook() {
  return {
    state: {
      search: "",
      status: [],
      health: [],
      tlds: [],
      providers: [],
      domainId: null,
      filteredDomainName: null,
      availableTlds: [],
      availableProviders: emptyProviders,
      hasActiveFilters: false,
      stats: { expiringSoon: 0, pendingVerification: 0 },
    },
    actions: {
      setSearch: vi.fn<(value: string) => void>(),
      setStatus: vi.fn<(values: ("verified" | "pending")[]) => void>(),
      setHealth: vi.fn<(values: ("healthy" | "expiring" | "expired")[]) => void>(),
      setTlds: vi.fn<(values: string[]) => void>(),
      setProviders: vi.fn<(values: string[]) => void>(),
      clearFilters: vi.fn<() => void>(),
      applyHealthFilter: vi.fn<(filter: "healthy" | "expiring" | "expired" | "pending") => void>(),
      clearDomainId: vi.fn<() => void>(),
    },
  };
}

function stubPaginationHook() {
  return {
    state: { pageIndex: 0, pageSize: 10 as const },
    actions: {
      setPageIndex: vi.fn<(pageIndex: number) => void>(),
      setPageSize: vi.fn<(pageSize: 10 | 25 | 50 | 100) => void>(),
      resetPage: vi.fn<() => void>(),
    },
  };
}

export function resetDashboardTestState() {
  localStorage.clear();
  usePreferencesStore.setState({
    viewMode: "grid",
    pageSize: 10,
    columnVisibility: {},
    showToolCalls: true,
    showReasoning: false,
    hideAiFeatures: false,
    aiMode: "cloud",
  });
  mockSubscription.plan = "pro";
  mockSubscription.planQuota = 100;
  mockSubscription.endsAt = null;
  mockSubscription.activeCount = 4;
  mockSubscription.archivedCount = 0;
  mockSubscription.canAddMore = true;
  for (const spy of Object.values(dashboardActionSpies)) {
    spy.mockClear();
  }
}

type DashboardTestShellProps = {
  domains: TrackedDomainWithDetails[];
  totalDomains: number;
  userName?: string;
};

function DashboardTestShell({
  domains,
  totalDomains,
  userName = "Test User",
}: DashboardTestShellProps) {
  const viewMode = usePreferencesStore((s) => s.viewMode);
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

  const paginationHook = useDashboardPagination();
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
    pageIndex: paginationHook.state.pageIndex,
    pageSize: paginationHook.state.pageSize,
    filterSignature: getDashboardFilterSignature(filterHook.state),
    resetPage: paginationHook.actions.resetPage,
  });

  const [tableInstance, setTableInstance] = useState<DashboardTable | null>(null);

  return (
    <DashboardProvider
      onVerify={dashboardActionSpies.onVerify}
      onRemove={dashboardActionSpies.onRemove}
      onArchive={dashboardActionSpies.onArchive}
      onUnarchive={dashboardActionSpies.onUnarchive}
      onToggleMuted={dashboardActionSpies.onToggleMuted}
      onBulkArchive={dashboardActionSpies.onBulkArchive}
      onBulkDelete={dashboardActionSpies.onBulkDelete}
      isBulkArchiving={false}
      isBulkDeleting={false}
      filterHook={filterHook}
      sortOption={sortOption}
      setSortOption={setSortParam}
      table={viewMode === "table" ? tableInstance : null}
      setTable={setTableInstance}
      paginationHook={paginationHook}
    >
      <div className="space-y-6">
        <DashboardHeader userName={userName} />
        {totalDomains > 0 && (
          <div className="space-y-4">
            <HealthSummary />
            <DashboardFilters />
          </div>
        )}
        <DashboardContent
          domains={filteredDomains}
          totalDomains={totalDomains}
          onTableReady={setTableInstance}
        />
      </div>
    </DashboardProvider>
  );
}

export type RenderDashboardShellOptions = {
  domains?: TrackedDomainWithDetails[];
  totalDomains?: number;
  searchParams?: string;
  userName?: string;
};

export function renderDashboardShell(options: RenderDashboardShellOptions = {}) {
  const domains = options.domains ?? makeDashboardDomains();
  const totalDomains = options.totalDomains ?? domains.length;
  mockSubscription.activeCount = totalDomains;

  const urlUpdates: string[] = [];

  const view = render(
    <NuqsTestingAdapter
      searchParams={options.searchParams ?? ""}
      hasMemory
      onUrlUpdate={(event) => {
        urlUpdates.push(event.queryString);
      }}
    >
      <DashboardTestShell
        domains={domains}
        totalDomains={totalDomains}
        userName={options.userName}
      />
    </NuqsTestingAdapter>,
  );

  return { ...view, domains, urlUpdates };
}

export function renderArchivedList(domains: TrackedDomainWithDetails[]) {
  mockSubscription.activeCount = 0;
  return render(
    <DashboardProvider
      onVerify={dashboardActionSpies.onVerify}
      onRemove={dashboardActionSpies.onRemove}
      onArchive={dashboardActionSpies.onArchive}
      onUnarchive={dashboardActionSpies.onUnarchive}
      onToggleMuted={dashboardActionSpies.onToggleMuted}
      onBulkArchive={dashboardActionSpies.onBulkArchive}
      onBulkDelete={dashboardActionSpies.onBulkDelete}
      isBulkArchiving={false}
      isBulkDeleting={false}
      filterHook={stubFilterHook()}
      sortOption={DEFAULT_SORT}
      setSortOption={vi.fn<(sort: SortOption) => void>()}
      table={null}
      setTable={vi.fn<(table: DashboardTable | null) => void>()}
      paginationHook={stubPaginationHook()}
    >
      <ArchivedDomainsList domains={domains} />
    </DashboardProvider>,
  );
}

const nativeMatchMedia = window.matchMedia.bind(window);
window.matchMedia = (query: string) => {
  const forcedMatch =
    query.includes("prefers-reduced-motion") ||
    query === "(hover: hover)" ||
    query === "(pointer: fine)";
  const forcedMiss = query === "(pointer: coarse)";

  if (forcedMatch || forcedMiss) {
    return {
      matches: forcedMatch,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    };
  }
  return nativeMatchMedia(query);
};

vi.setSystemTime(DASHBOARD_TEST_NOW);
