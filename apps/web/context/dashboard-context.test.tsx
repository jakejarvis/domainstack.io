import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { memo, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import {
  type DashboardActions,
  type DashboardBulkActions,
  DashboardProvider,
  useDashboardActions,
  useDashboardView,
} from "@/context/dashboard-context";
import { render } from "@/mocks/react";

const bulk: DashboardBulkActions = {
  onBulkArchive: vi.fn<(domainIds: string[]) => void>(),
  onBulkDelete: vi.fn<(domainIds: string[]) => void>(),
  onBulkMute: vi.fn<(domainIds: string[], muted: boolean) => void>(),
  isBulkArchiving: false,
  isBulkDeleting: false,
  isBulkMuting: false,
};

const actionRenderSpy = vi.fn<() => void>();

function Probe() {
  useDashboardActions();
  actionRenderSpy();
  return <span data-testid="probe">actions</span>;
}

const MemoProbe = memo(Probe);

function FiltersProbe() {
  const { search, setSearch } = useDashboardView();
  return (
    <>
      <button type="button" onClick={() => setSearch("abc")}>
        type
      </button>
      <span data-testid="search">{search}</span>
    </>
  );
}

function makeActions(): DashboardActions {
  return {
    onRemove: vi.fn<(id: string) => void>(),
    onArchive: vi.fn<(id: string) => void>(),
    onUnarchive: vi.fn<(id: string) => void>(),
    onMute: vi.fn<(id: string, muted: boolean) => void>(),
  };
}

function Harness() {
  const [actions, setActions] = useState(makeActions);

  return (
    <NuqsTestingAdapter hasMemory>
      <button type="button" onClick={() => setActions(makeActions())}>
        replace actions
      </button>
      <DashboardProvider domains={[]} actions={actions} bulk={bulk}>
        <MemoProbe />
        <FiltersProbe />
      </DashboardProvider>
    </NuqsTestingAdapter>
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

  it("re-renders action consumers when the actions change", async () => {
    await render(<Harness />);
    const rendersBefore = actionRenderSpy.mock.calls.length;

    await page.getByRole("button", { name: "replace actions" }).click();
    await expect.poll(() => actionRenderSpy.mock.calls.length).toBeGreaterThan(rendersBefore);
  });
});
