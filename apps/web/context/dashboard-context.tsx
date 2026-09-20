"use client";

import { createContext, useContext, useMemo } from "react";

import type {
  AvailableProvidersByCategory,
  DashboardPageSizeOptions,
  HealthFilter,
  SortOption,
  StatusFilter,
} from "@/lib/dashboard-utils";
import type { VerificationMethod } from "@domainstack/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DomainActions {
  onVerify: (id: string, verificationMethod: VerificationMethod | null) => void;
  onRemove: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onMute: (id: string, muted: boolean) => void;
  /** Domain ID currently navigating to the verify flow, if any. */
  verifyingDomainId: string | null;
}

interface BulkState {
  onBulkArchive: (domainIds: string[]) => void;
  onBulkDelete: (domainIds: string[]) => void;
  onBulkMute: (domainIds: string[], muted: boolean) => void;
  isBulkArchiving: boolean;
  isBulkDeleting: boolean;
  isBulkMuting: boolean;
}

export interface FilterState {
  search: string;
  status: StatusFilter[];
  health: HealthFilter[];
  tlds: string[];
  providers: string[];
  domainId: string | null;
  filteredDomainName: string | null;
  availableTlds: string[];
  availableProviders: AvailableProvidersByCategory;
  hasActiveFilters: boolean;
  stats: { expiringSoon: number; pendingVerification: number };
  // Sort (grid view only)
  sortOption: SortOption;
}

export interface FilterActions {
  setSearch: (value: string) => void;
  setStatus: (values: StatusFilter[]) => void;
  setHealth: (values: HealthFilter[]) => void;
  setTlds: (values: string[]) => void;
  setProviders: (values: string[]) => void;
  clearFilters: () => void;
  applyHealthFilter: (filter: HealthFilter | "pending") => void;
  clearDomainId: () => void;
  setSortOption: (sort: SortOption) => void;
}

export interface PaginationState {
  pageIndex: number;
  pageSize: DashboardPageSizeOptions;
}

export interface PaginationActions {
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: DashboardPageSizeOptions) => void;
  resetPage: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DashboardActionsContext = createContext<DomainActions | null>(null);
const DashboardBulkContext = createContext<BulkState | null>(null);
const DashboardFiltersContext = createContext<(FilterState & FilterActions) | null>(null);
const DashboardPaginationContext = createContext<(PaginationState & PaginationActions) | null>(
  null,
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DashboardProviderProps {
  children: React.ReactNode;
  /** Domain action handlers */
  onVerify: (id: string, verificationMethod: VerificationMethod | null) => void;
  onRemove: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onMute: (id: string, muted: boolean) => void;
  /** Domain ID currently navigating to the verify flow, if any. */
  verifyingDomainId?: string | null;
  /** Bulk action handlers */
  onBulkArchive: (domainIds: string[]) => void;
  onBulkDelete: (domainIds: string[]) => void;
  onBulkMute: (domainIds: string[], muted: boolean) => void;
  isBulkArchiving: boolean;
  isBulkDeleting: boolean;
  isBulkMuting: boolean;
  /** Filter hook result - passed directly from useDashboardFilters */
  filterHook: {
    state: Omit<FilterState, "sortOption">;
    actions: Omit<FilterActions, "setSortOption">;
  };
  /** Sort state (grid view only) */
  sortOption: SortOption;
  setSortOption: (sort: SortOption) => void;
  /** Pagination hook result - passed directly from useDashboardPagination */
  paginationHook: {
    state: PaginationState;
    actions: PaginationActions;
  };
}

export function DashboardProvider({
  children,
  onVerify,
  onRemove,
  onArchive,
  onUnarchive,
  onMute,
  verifyingDomainId = null,
  onBulkArchive,
  onBulkDelete,
  onBulkMute,
  isBulkArchiving,
  isBulkDeleting,
  isBulkMuting,
  filterHook,
  sortOption,
  setSortOption,
  paginationHook,
}: DashboardProviderProps) {
  const actions = useMemo<DomainActions>(
    () => ({
      onVerify,
      onRemove,
      onArchive,
      onUnarchive,
      onMute,
      verifyingDomainId,
    }),
    [onVerify, onRemove, onArchive, onUnarchive, onMute, verifyingDomainId],
  );
  const bulk = useMemo<BulkState>(
    () => ({
      onBulkArchive,
      onBulkDelete,
      onBulkMute,
      isBulkArchiving,
      isBulkDeleting,
      isBulkMuting,
    }),
    [onBulkArchive, onBulkDelete, onBulkMute, isBulkArchiving, isBulkDeleting, isBulkMuting],
  );
  const filters = useMemo<FilterState & FilterActions>(
    () => ({
      ...filterHook.state,
      ...filterHook.actions,
      sortOption,
      setSortOption,
    }),
    [filterHook.state, filterHook.actions, sortOption, setSortOption],
  );
  const pagination = useMemo<PaginationState & PaginationActions>(
    () => ({
      ...paginationHook.state,
      ...paginationHook.actions,
    }),
    [paginationHook.state, paginationHook.actions],
  );

  return (
    <DashboardActionsContext.Provider value={actions}>
      <DashboardBulkContext.Provider value={bulk}>
        <DashboardFiltersContext.Provider value={filters}>
          <DashboardPaginationContext.Provider value={pagination}>
            {children}
          </DashboardPaginationContext.Provider>
        </DashboardFiltersContext.Provider>
      </DashboardBulkContext.Provider>
    </DashboardActionsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useRequiredContext<T>(context: React.Context<T | null>): T {
  const value = useContext(context);
  if (!value) {
    throw new Error("useDashboardContext must be used within a DashboardProvider");
  }
  return value;
}

/** Access domain action callbacks */
export function useDashboardActions() {
  return useRequiredContext(DashboardActionsContext);
}

/** Access bulk action callbacks and loading states */
export function useDashboardBulkActions() {
  return useRequiredContext(DashboardBulkContext);
}

/** Access filter state and actions */
export function useDashboardFiltersContext() {
  return useRequiredContext(DashboardFiltersContext);
}

/** Access pagination state and actions */
export function useDashboardPaginationContext() {
  return useRequiredContext(DashboardPaginationContext);
}
