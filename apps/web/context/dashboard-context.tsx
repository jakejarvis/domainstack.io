"use client";

import { createContext, useContext, useLayoutEffect, useRef } from "react";

import { type DashboardView, useDashboardViewState } from "@/hooks/use-dashboard-view";
import type { TrackedDomainWithDetails } from "@domainstack/types";

export interface DashboardActions {
  onRemove: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onMute: (id: string, muted: boolean) => void;
}

export interface DashboardBulkActions {
  onBulkArchive: (domainIds: string[]) => void;
  onBulkDelete: (domainIds: string[]) => void;
  onBulkMute: (domainIds: string[], muted: boolean) => void;
  isBulkArchiving: boolean;
  isBulkDeleting: boolean;
  isBulkMuting: boolean;
}

// Split so row/card action consumers don't re-render on every filter keystroke.
const DashboardActionsContext = createContext<DashboardActions | null>(null);
const DashboardBulkContext = createContext<DashboardBulkActions | null>(null);
const DashboardViewContext = createContext<DashboardView | null>(null);
// A stable ref, so range selection can read the current order at click time
// without every card and row subscribing to view changes.
const DashboardVisibleIdsContext = createContext<React.RefObject<string[]> | null>(null);

/**
 * Owns the dashboard's view state (filters, sort, pagination) for `domains` and
 * exposes it alongside the action handlers. Pass `actions` and `bulk` with
 * stable identities; they're provided as-is.
 */
export function DashboardProvider({
  domains,
  actions,
  bulk,
  children,
}: {
  domains: TrackedDomainWithDetails[];
  actions: DashboardActions;
  bulk: DashboardBulkActions;
  children: React.ReactNode;
}) {
  const view = useDashboardViewState(domains);
  const visibleIdsRef = useRef(view.visibleDomainIds);
  useLayoutEffect(() => {
    visibleIdsRef.current = view.visibleDomainIds;
  }, [view.visibleDomainIds]);

  return (
    <DashboardActionsContext.Provider value={actions}>
      <DashboardBulkContext.Provider value={bulk}>
        <DashboardVisibleIdsContext.Provider value={visibleIdsRef}>
          <DashboardViewContext.Provider value={view}>{children}</DashboardViewContext.Provider>
        </DashboardVisibleIdsContext.Provider>
      </DashboardBulkContext.Provider>
    </DashboardActionsContext.Provider>
  );
}

function useRequiredContext<T>(context: React.Context<T | null>): T {
  const value = useContext(context);
  if (!value) {
    throw new Error("useDashboardContext must be used within a DashboardProvider");
  }
  return value;
}

/** Per-domain action handlers */
export function useDashboardActions() {
  return useRequiredContext(DashboardActionsContext);
}

/** Bulk action handlers and loading states */
export function useDashboardBulkActions() {
  return useRequiredContext(DashboardBulkContext);
}

/** Filters, sort, pagination, and the resulting visible domains */
export function useDashboardView() {
  return useRequiredContext(DashboardViewContext);
}

/** Current visible domain order, read at event time; never triggers a re-render. */
export function useDashboardVisibleIdsRef() {
  return useRequiredContext(DashboardVisibleIdsContext);
}
