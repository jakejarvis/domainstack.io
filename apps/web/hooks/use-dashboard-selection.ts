import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import {
  hasSelectionAtom,
  isAllSelectedAtom,
  isPartiallySelectedAtom,
  selectedCountAtom,
  selectedDomainIdsAtom,
  visibleDomainIdsAtom,
} from "@/lib/atoms/dashboard-atoms";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSelectionState {
  selectedIds: Set<string>;
  selectedCount: number;
  hasSelection: boolean;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
}

export interface DashboardSelectionActions {
  toggle: (id: string) => void;
  isSelected: (id: string) => boolean;
  selectAll: () => void;
  clearSelection: () => void;
  toggleAll: () => void;
}

export type UseDashboardSelectionReturn = DashboardSelectionState &
  DashboardSelectionActions;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages dashboard domain selection state via Jotai atoms.
 *
 * Features:
 * - Multi-select with toggle, select all, clear
 * - Derived state (count, isAllSelected, isPartiallySelected)
 * - Clears stale selections when visible domain IDs change
 * - Escape key clears selection
 */
export function useDashboardSelection(): UseDashboardSelectionReturn {
  const [selectedIds, setSelectedIds] = useAtom(selectedDomainIdsAtom);
  const visibleDomainIds = useAtomValue(visibleDomainIdsAtom);
  const selectedCount = useAtomValue(selectedCountAtom);
  const hasSelection = useAtomValue(hasSelectionAtom);
  const isAllSelected = useAtomValue(isAllSelectedAtom);
  const isPartiallySelected = useAtomValue(isPartiallySelectedAtom);

  // ---------------------------------------------------------------------------
  // Clear stale selections when visible domain IDs change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setSelectedIds((prev: Set<string>) => {
      const visibleSet = new Set(visibleDomainIds);
      const filtered = new Set<string>();
      for (const id of prev) {
        if (visibleSet.has(id)) {
          filtered.add(id);
        }
      }
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [visibleDomainIds, setSelectedIds]);

  // ---------------------------------------------------------------------------
  // Escape key clears selection
  // ---------------------------------------------------------------------------

  const selectedCountRef = useRef(selectedIds.size);
  selectedCountRef.current = selectedIds.size;

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, [setSelectedIds]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedCountRef.current > 0) {
        clearSelection();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection]);

  // ---------------------------------------------------------------------------
  // Selection Actions
  // ---------------------------------------------------------------------------

  const toggle = useCallback(
    (id: string) => {
      setSelectedIds((prev: Set<string>) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [setSelectedIds],
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(visibleDomainIds));
  }, [visibleDomainIds, setSelectedIds]);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev: Set<string>) => {
      const allSelected = visibleDomainIds.every((id) => prev.has(id));
      if (allSelected && visibleDomainIds.length > 0) {
        // Deselect all visible
        const next = new Set(prev);
        for (const id of visibleDomainIds) {
          next.delete(id);
        }
        return next;
      }
      // Select all visible
      return new Set(visibleDomainIds);
    });
  }, [visibleDomainIds, setSelectedIds]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    selectedIds,
    selectedCount,
    hasSelection,
    isAllSelected,
    isPartiallySelected,
    // Actions
    toggle,
    isSelected,
    selectAll,
    clearSelection,
    toggleAll,
  };
}

// ---------------------------------------------------------------------------
// Utility Hook: Sync visible domain IDs to atom
// ---------------------------------------------------------------------------

/**
 * Syncs the visible domain IDs to the Jotai atom.
 * Call this from the parent component that owns the filtered domains.
 */
export function useSyncVisibleDomainIds(domainIds: string[]): void {
  const setVisibleDomainIds = useSetAtom(visibleDomainIdsAtom);

  useEffect(() => {
    setVisibleDomainIds(domainIds);
  }, [domainIds, setVisibleDomainIds]);
}
