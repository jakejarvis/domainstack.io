import { parseAsString, useQueryState } from "nuqs";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useCallback, useMemo, useState } from "react";
import { vi } from "vitest";

import { ArchivedDomainsList } from "@/components/dashboard/archived-domains-list";
import { DashboardConfirmDialog } from "@/components/dashboard/dashboard-confirm-dialog";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { HealthSummary } from "@/components/dashboard/health-summary";
import {
  mockSubscription,
  resetSubscriptionActionSpies,
} from "@/components/dashboard/mocks/subscription";
import { DashboardProvider } from "@/context/dashboard-context";
import { useDashboardFilters } from "@/hooks/use-dashboard-filters";
import {
  getDashboardFilterSignature,
  useDashboardPagination,
  useSyncDashboardPage,
} from "@/hooks/use-dashboard-pagination";
import { useSyncVisibleDomainIds } from "@/hooks/use-dashboard-selection";
import { resetHydratedNow } from "@/hooks/use-hydrated-now";
import {
  type ConfirmAction,
  DEFAULT_SORT,
  SORT_OPTIONS,
  type SortOption,
  sortDomains,
} from "@/lib/dashboard-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { render } from "@/mocks/react";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { TooltipProvider } from "@domainstack/ui/tooltip";

import { DASHBOARD_TEST_NOW, makeDashboardDomains } from "./test-fixtures";

export {
  mockSubscription,
  subscriptionActionSpies,
} from "@/components/dashboard/mocks/subscription";

export const dashboardActionSpies = {
  onVerify: vi.fn<(id: string, method: string | null) => void>(),
  onRemove: vi.fn<(id: string) => void>(),
  onArchive: vi.fn<(id: string) => void>(),
  onUnarchive: vi.fn<(id: string) => void>(),
  onMute: vi.fn<(id: string, muted: boolean) => void>(),
  onBulkArchive: vi.fn<(domainIds: string[]) => void>(),
  onBulkDelete: vi.fn<(domainIds: string[]) => void>(),
  onBulkMute: vi.fn<(domainIds: string[], muted: boolean) => void>(),
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(DASHBOARD_TEST_NOW);
  resetHydratedNow(DASHBOARD_TEST_NOW);
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
  resetSubscriptionActionSpies();
}

type DashboardTestShellProps = {
  domains: TrackedDomainWithDetails[];
  totalDomains: number;
  userName?: string;
  confirmActions?: boolean;
};

function DashboardTestShell({
  domains,
  totalDomains,
  userName = "Test User",
  confirmActions = false,
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

  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(null);

  const requestRemove = useCallback(
    (id: string) => {
      const domainName = domains.find((d) => d.id === id)?.domainName;
      if (!domainName) return;
      setPendingAction({ type: "remove", domainId: id, domainName });
    },
    [domains],
  );
  const requestArchive = useCallback(
    (id: string) => {
      const domainName = domains.find((d) => d.id === id)?.domainName;
      if (!domainName) return;
      setPendingAction({ type: "archive", domainId: id, domainName });
    },
    [domains],
  );
  const requestBulkArchive = useCallback((domainIds: string[]) => {
    setPendingAction({ type: "bulk-archive", domainIds, count: domainIds.length });
  }, []);
  const requestBulkDelete = useCallback((domainIds: string[]) => {
    setPendingAction({ type: "bulk-delete", domainIds, count: domainIds.length });
  }, []);

  const onRemove = confirmActions ? requestRemove : dashboardActionSpies.onRemove;
  const onArchive = confirmActions ? requestArchive : dashboardActionSpies.onArchive;
  const onBulkArchive = confirmActions ? requestBulkArchive : dashboardActionSpies.onBulkArchive;
  const onBulkDelete = confirmActions ? requestBulkDelete : dashboardActionSpies.onBulkDelete;

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "remove") {
      dashboardActionSpies.onRemove(pendingAction.domainId);
    } else if (pendingAction.type === "archive") {
      dashboardActionSpies.onArchive(pendingAction.domainId);
    } else if (pendingAction.type === "bulk-archive") {
      dashboardActionSpies.onBulkArchive(pendingAction.domainIds);
    } else if (pendingAction.type === "bulk-delete") {
      dashboardActionSpies.onBulkDelete(pendingAction.domainIds);
    }
    setPendingAction(null);
  };

  return (
    <DashboardProvider
      onVerify={dashboardActionSpies.onVerify}
      onRemove={onRemove}
      onArchive={onArchive}
      onUnarchive={dashboardActionSpies.onUnarchive}
      onMute={dashboardActionSpies.onMute}
      onBulkArchive={onBulkArchive}
      onBulkDelete={onBulkDelete}
      onBulkMute={dashboardActionSpies.onBulkMute}
      isBulkArchiving={false}
      isBulkDeleting={false}
      isBulkMuting={false}
      filterHook={filterHook}
      sortOption={sortOption}
      setSortOption={setSortParam}
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
        <DashboardContent domains={filteredDomains} totalDomains={totalDomains} />
      </div>
      {confirmActions && pendingAction ? (
        <DashboardConfirmDialog
          pendingAction={pendingAction}
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          onConfirm={handleConfirm}
        />
      ) : null}
    </DashboardProvider>
  );
}

export type RenderDashboardShellOptions = {
  domains?: TrackedDomainWithDetails[];
  totalDomains?: number;
  searchParams?: string;
  userName?: string;
  confirmActions?: boolean;
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
        confirmActions={options.confirmActions}
      />
    </NuqsTestingAdapter>,
  );

  return { ...view, domains, urlUpdates };
}

export function renderDashboardConfirmShell(options: RenderDashboardShellOptions = {}) {
  return renderDashboardShell({ ...options, confirmActions: true });
}

export function renderArchivedList(domains: TrackedDomainWithDetails[]) {
  mockSubscription.activeCount = 0;
  return render(
    <TooltipProvider>
      <DashboardProvider
        onVerify={dashboardActionSpies.onVerify}
        onRemove={dashboardActionSpies.onRemove}
        onArchive={dashboardActionSpies.onArchive}
        onUnarchive={dashboardActionSpies.onUnarchive}
        onMute={dashboardActionSpies.onMute}
        onBulkArchive={dashboardActionSpies.onBulkArchive}
        onBulkDelete={dashboardActionSpies.onBulkDelete}
        onBulkMute={dashboardActionSpies.onBulkMute}
        isBulkArchiving={false}
        isBulkDeleting={false}
        isBulkMuting={false}
        filterHook={stubFilterHook()}
        sortOption={DEFAULT_SORT}
        setSortOption={vi.fn<(sort: SortOption) => void>()}
        paginationHook={stubPaginationHook()}
      >
        <ArchivedDomainsList domains={domains} />
      </DashboardProvider>
    </TooltipProvider>,
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

vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(DASHBOARD_TEST_NOW);
resetHydratedNow(DASHBOARD_TEST_NOW);
