import { memo, useMemo, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import {
  DashboardProvider,
  useDashboardActions,
  useDashboardFiltersContext,
} from "@/context/dashboard-context";
import { render } from "@/mocks/react";
import type { VerificationMethod } from "@domainstack/types";

const actions = {
  onVerify: vi.fn<(id: string, method: VerificationMethod | null) => void>(),
  onRemove: vi.fn<(id: string) => void>(),
  onArchive: vi.fn<(id: string) => void>(),
  onUnarchive: vi.fn<(id: string) => void>(),
  onMute: vi.fn<(id: string, muted: boolean) => void>(),
  onBulkArchive: vi.fn<(domainIds: string[]) => void>(),
  onBulkDelete: vi.fn<(domainIds: string[]) => void>(),
  onBulkMute: vi.fn<(domainIds: string[], muted: boolean) => void>(),
};

const filterActions = {
  setSearch: vi.fn<(value: string) => void>(),
  setStatus: vi.fn<(values: ("verified" | "pending")[]) => void>(),
  setHealth: vi.fn<(values: ("healthy" | "expiring" | "expired")[]) => void>(),
  setTlds: vi.fn<(values: string[]) => void>(),
  setProviders: vi.fn<(values: string[]) => void>(),
  clearFilters: vi.fn<() => void>(),
  applyHealthFilter: vi.fn<(filter: "healthy" | "expiring" | "expired" | "pending") => void>(),
  clearDomainId: vi.fn<() => void>(),
};

const paginationHook = {
  state: { pageIndex: 0, pageSize: 10 as const },
  actions: {
    setPageIndex: vi.fn<(pageIndex: number) => void>(),
    setPageSize: vi.fn<(pageSize: 10 | 25 | 50 | 100) => void>(),
    resetPage: vi.fn<() => void>(),
  },
};

const setSortOption = vi.fn<(sort: `${string}.asc` | `${string}.desc`) => void>();
const actionRenderSpy = vi.fn<() => void>();

function Probe() {
  useDashboardActions();
  actionRenderSpy();
  return <span data-testid="probe">actions</span>;
}

const MemoProbe = memo(Probe);

function FiltersProbe() {
  const { search } = useDashboardFiltersContext();
  return <span data-testid="search">{search}</span>;
}

function Harness() {
  const [search, setSearch] = useState("");
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const filterState = useMemo(
    () => ({
      search,
      status: [] as ("verified" | "pending")[],
      health: [] as ("healthy" | "expiring" | "expired")[],
      tlds: [],
      providers: [],
      domainId: null,
      filteredDomainName: null,
      availableTlds: [],
      availableProviders: { registrar: [], dns: [], hosting: [], email: [], ca: [] },
      hasActiveFilters: search !== "",
      stats: { expiringSoon: 0, pendingVerification: 0 },
    }),
    [search],
  );
  const filterHook = useMemo(() => ({ state: filterState, actions: filterActions }), [filterState]);

  return (
    <>
      <button type="button" onClick={() => setSearch("abc")}>
        type
      </button>
      <button type="button" onClick={() => setVerifyingDomainId("d1")}>
        verify
      </button>
      <DashboardProvider
        {...actions}
        verifyingDomainId={verifyingDomainId}
        isBulkArchiving={false}
        isBulkDeleting={false}
        isBulkMuting={false}
        filterHook={filterHook}
        sortOption="domainName.asc"
        setSortOption={setSortOption}
        paginationHook={paginationHook}
      >
        <MemoProbe />
        <FiltersProbe />
      </DashboardProvider>
    </>
  );
}

describe("DashboardProvider", () => {
  beforeEach(() => {
    actionRenderSpy.mockClear();
  });

  it("does not re-render action consumers when filters change", async () => {
    await render(<Harness />);
    const rendersBefore = actionRenderSpy.mock.calls.length;

    await page.getByRole("button", { name: "type" }).click();
    await expect.element(page.getByTestId("search")).toHaveTextContent("abc");

    expect(actionRenderSpy).toHaveBeenCalledTimes(rendersBefore);
  });

  it("re-renders action consumers when action state changes", async () => {
    await render(<Harness />);
    const rendersBefore = actionRenderSpy.mock.calls.length;

    await page.getByRole("button", { name: "verify" }).click();
    await expect.poll(() => actionRenderSpy.mock.calls.length).toBeGreaterThan(rendersBefore);
  });
});
