import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useMemo, useState } from "react";
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
import {
  type DashboardActions,
  type DashboardBulkActions,
  DashboardProvider,
} from "@/context/dashboard-context";
import { resetHydratedNow } from "@/hooks/use-hydrated-now";
import type { ConfirmAction } from "@/lib/dashboard-utils";
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

const spyActions: DashboardActions = {
  onVerify: dashboardActionSpies.onVerify,
  onRemove: dashboardActionSpies.onRemove,
  onArchive: dashboardActionSpies.onArchive,
  onUnarchive: dashboardActionSpies.onUnarchive,
  onMute: dashboardActionSpies.onMute,
  verifyingDomainId: null,
};

const spyBulk: DashboardBulkActions = {
  onBulkArchive: dashboardActionSpies.onBulkArchive,
  onBulkDelete: dashboardActionSpies.onBulkDelete,
  onBulkMute: dashboardActionSpies.onBulkMute,
  isBulkArchiving: false,
  isBulkDeleting: false,
  isBulkMuting: false,
};

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
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(null);

  // With `confirmActions`, remove/archive go through the confirm dialog like the real
  // dashboard, and the spies fire on confirm instead of on click.
  const actions = useMemo<DashboardActions>(() => {
    if (!confirmActions) return spyActions;
    const confirmSingle = (type: "remove" | "archive", id: string) => {
      const domainName = domains.find((d) => d.id === id)?.domainName;
      if (domainName) setPendingAction({ type, domainId: id, domainName });
    };
    return {
      ...spyActions,
      onRemove: (id) => confirmSingle("remove", id),
      onArchive: (id) => confirmSingle("archive", id),
    };
  }, [confirmActions, domains]);

  const bulk = useMemo<DashboardBulkActions>(
    () =>
      confirmActions
        ? {
            ...spyBulk,
            onBulkArchive: (domainIds) =>
              setPendingAction({ type: "bulk-archive", domainIds, count: domainIds.length }),
            onBulkDelete: (domainIds) =>
              setPendingAction({ type: "bulk-delete", domainIds, count: domainIds.length }),
          }
        : spyBulk,
    [confirmActions],
  );

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
    <DashboardProvider domains={domains} actions={actions} bulk={bulk}>
      <div className="space-y-6">
        <DashboardHeader userName={userName} />
        {totalDomains > 0 && (
          <div className="space-y-4">
            <HealthSummary />
            <DashboardFilters />
          </div>
        )}
        <DashboardContent totalDomains={totalDomains} />
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

export async function renderDashboardShell(options: RenderDashboardShellOptions = {}) {
  const domains = options.domains ?? makeDashboardDomains();
  const totalDomains = options.totalDomains ?? domains.length;
  mockSubscription.activeCount = totalDomains;

  const urlUpdates: string[] = [];

  const view = await render(
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

export async function renderDashboardConfirmShell(options: RenderDashboardShellOptions = {}) {
  return renderDashboardShell({ ...options, confirmActions: true });
}

export async function renderArchivedList(domains: TrackedDomainWithDetails[]) {
  mockSubscription.activeCount = 0;
  return render(
    <NuqsTestingAdapter>
      <TooltipProvider>
        <DashboardProvider domains={[]} actions={spyActions} bulk={spyBulk}>
          <ArchivedDomainsList domains={domains} />
        </DashboardProvider>
      </TooltipProvider>
    </NuqsTestingAdapter>,
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
