"use client";

import type { Table } from "@tanstack/react-table";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VerificationMethod } from "@/lib/constants/verification";
import type {
  AvailableProvidersByCategory,
  DashboardPageSizeOptions,
  HealthFilter,
  SortOption,
  StatusFilter,
} from "@/lib/dashboard-utils";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelectionState {
  selectedIds: Set<string>;
  selectedCount: number;
  hasSelection: boolean;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
}

interface SelectionActions {
  toggle: (id: string) => void;
  isSelected: (id: string) => boolean;
  selectAll: () => void;
  clearSelection: () => void;
  toggleAll: () => void;
}

interface DomainActions {
  onVerify: (id: string, verificationMethod: VerificationMethod | null) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive: (id: string, domainName: string) => void;
  onUnarchive: (id: string) => void;
  onToggleMuted: (id: string, muted: boolean) => void;
}

interface BulkState {
  onBulkArchive: () => void;
  onBulkDelete: () => void;
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
  selection: SelectionState & SelectionActions;
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
  /** All selectable domain IDs (after filtering) */
  domainIds: string[];
  /** Domain action handlers */
  onVerify: (id: string, verificationMethod: VerificationMethod | null) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive: (id: string, domainName: string) => void;
  onUnarchive: (id: string) => void;
  onToggleMuted: (id: string, muted: boolean) => void;
  /** Bulk action handlers (called with selected domain IDs) */
  onBulkArchive: (domainIds: string[]) => void;
  onBulkDelete: (domainIds: string[]) => void;
  isBulkArchiving: boolean;
  isBulkDeleting: boolean;
  /** Filter state - passed in from parent to allow snapshot/restore */
  filterState: FilterState;
  filterActions: FilterActions;
  /** Pagination state - passed in from parent to allow snapshot/restore */
  paginationState: PaginationState;
  paginationActions: PaginationActions;
}

export function DashboardProvider({
  children,
  domainIds,
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
  // ----- Selection State -----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Clear stale selections when domainIds changes (e.g., filter applied)
  useEffect(() => {
    setSelectedIds((prev) => {
      const domainIdsSet = new Set(domainIds);
      const filtered = new Set<string>();
      for (const id of prev) {
        if (domainIdsSet.has(id)) {
          filtered.add(id);
        }
      }
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [domainIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(domainIds));
  }, [domainIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = domainIds.every((id) => prev.has(id));
      if (allSelected && domainIds.length > 0) {
        const next = new Set(prev);
        for (const id of domainIds) {
          next.delete(id);
        }
        return next;
      }
      return new Set(domainIds);
    });
  }, [domainIds]);

  // Escape key clears selection
  const selectedCountRef = useRef(selectedIds.size);
  selectedCountRef.current = selectedIds.size;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedCountRef.current > 0) {
        clearSelection();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection]);

  // Computed selection state
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const visibleSelectedCount = domainIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const isAllSelected =
    domainIds.length > 0 && visibleSelectedCount === domainIds.length;
  const isPartiallySelected =
    visibleSelectedCount > 0 && visibleSelectedCount < domainIds.length;

  // ----- Bulk Actions (wrap to use current selection) -----
  const handleBulkArchive = useCallback(() => {
    const selected = Array.from(selectedIds);
    if (selected.length > 0) {
      onBulkArchive(selected);
    }
  }, [selectedIds, onBulkArchive]);

  const handleBulkDelete = useCallback(() => {
    const selected = Array.from(selectedIds);
    if (selected.length > 0) {
      onBulkDelete(selected);
    }
  }, [selectedIds, onBulkDelete]);

  // ----- Context Value -----
  const value = useMemo<DashboardContextValue>(
    () => ({
      selection: {
        selectedIds,
        selectedCount,
        hasSelection,
        isAllSelected,
        isPartiallySelected,
        toggle,
        isSelected,
        selectAll,
        clearSelection,
        toggleAll,
      },
      actions: {
        onVerify,
        onRemove,
        onArchive,
        onUnarchive,
        onToggleMuted,
      },
      bulk: {
        onBulkArchive: handleBulkArchive,
        onBulkDelete: handleBulkDelete,
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
      selectedIds,
      selectedCount,
      hasSelection,
      isAllSelected,
      isPartiallySelected,
      toggle,
      isSelected,
      selectAll,
      clearSelection,
      toggleAll,
      onVerify,
      onRemove,
      onArchive,
      onUnarchive,
      onToggleMuted,
      handleBulkArchive,
      handleBulkDelete,
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

/** Access selection state and actions */
export function useDashboardSelection() {
  return useDashboardContext().selection;
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
export function useDashboardFilters() {
  return useDashboardContext().filters;
}

/** Access pagination state and actions */
export function useDashboardPagination() {
  return useDashboardContext().pagination;
}
