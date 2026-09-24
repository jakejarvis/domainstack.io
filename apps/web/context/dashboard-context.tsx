"use client";

import { createContext, useContext } from "react";

import { type DashboardView, useDashboardViewState } from "@/hooks/use-dashboard-view";
import type { TrackedDomainWithDetails, VerificationMethod } from "@domainstack/types";

export interface DashboardActions {
  onVerify: (id: string, verificationMethod: VerificationMethod | null) => void;
  onRemove: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onMute: (id: string, muted: boolean) => void;
  /** Domain ID currently navigating to the verify flow, if any. */
  verifyingDomainId: string | null;
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

  return (
    <DashboardActionsContext.Provider value={actions}>
      <DashboardBulkContext.Provider value={bulk}>
        <DashboardViewContext.Provider value={view}>{children}</DashboardViewContext.Provider>
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
