"use client";

import type { VerificationMethod } from "@domainstack/constants";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import type { Table } from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";
import type {
  AvailableProvidersByCategory,
  DashboardPageSizeOptions,
  HealthFilter,
  SortOption,
  StatusFilter,
} from "@/lib/dashboard-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DomainActions {
  onVerify: (id: string, verificationMethod: VerificationMethod | null) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive: (id: string, domainName: string) => void;
  onUnarchive: (id: string) => void;
  onToggleMuted: (id: string, muted: boolean) => void;
}

interface BulkState {
  onBulkArchive: (domainIds: string[]) => void;
  onBulkDelete: (domainIds: string[]) => void;
  isBulkArchiving: boolean;
  isBulkDeleting: boolean;
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
  // Table instance (for column visibility)
  table: Table<TrackedDomainWithDetails> | null;
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
  setTable: (table: Table<TrackedDomainWithDetails> | null) => void;
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

interface DashboardContextValue {
  actions: DomainActions;
  bulk: BulkState;
  filters: FilterState & FilterActions;
  pagination: PaginationState & PaginationActions;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DashboardContext = createContext<DashboardContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DashboardProviderProps {
  children: React.ReactNode;
  /** Domain action handlers */
  onVerify: (id: string, verificationMethod: VerificationMethod | null) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive: (id: string, domainName: string) => void;
  onUnarchive: (id: string) => void;
  onToggleMuted: (id: string, muted: boolean) => void;
  /** Bulk action handlers */
  onBulkArchive: (domainIds: string[]) => void;
  onBulkDelete: (domainIds: string[]) => void;
  isBulkArchiving: boolean;
  isBulkDeleting: boolean;
  /** Filter state - passed from useDashboardFilters hook */
  filterState: FilterState;
  filterActions: FilterActions;
  /** Pagination state - passed from useDashboardPagination hook */
  paginationState: PaginationState;
  paginationActions: PaginationActions;
}

export function DashboardProvider({
  children,
  onVerify,
  onRemove,
  onArchive,
  onUnarchive,
  onToggleMuted,
  onBulkArchive,
  onBulkDelete,
  isBulkArchiving,
  isBulkDeleting,
  filterState,
  filterActions,
  paginationState,
  paginationActions,
}: DashboardProviderProps) {
  const value = useMemo<DashboardContextValue>(
    () => ({
      actions: {
        onVerify,
        onRemove,
        onArchive,
        onUnarchive,
        onToggleMuted,
      },
      bulk: {
        onBulkArchive,
        onBulkDelete,
        isBulkArchiving,
        isBulkDeleting,
      },
      filters: {
        ...filterState,
        ...filterActions,
      },
      pagination: {
        ...paginationState,
        ...paginationActions,
      },
    }),
    [
      onVerify,
      onRemove,
      onArchive,
      onUnarchive,
      onToggleMuted,
      onBulkArchive,
      onBulkDelete,
      isBulkArchiving,
      isBulkDeleting,
      filterState,
      filterActions,
      paginationState,
      paginationActions,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error(
      "useDashboardContext must be used within a DashboardProvider",
    );
  }
  return context;
}

/** Access domain action callbacks */
export function useDashboardActions() {
  return useDashboardContext().actions;
}

/** Access bulk action callbacks and loading states */
export function useDashboardBulkActions() {
  return useDashboardContext().bulk;
}

/** Access filter state and actions */
export function useDashboardFiltersContext() {
  return useDashboardContext().filters;
}

/** Access pagination state and actions */
export function useDashboardPaginationContext() {
  return useDashboardContext().pagination;
}
