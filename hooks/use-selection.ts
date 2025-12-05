"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Hook for managing multi-select state with O(1) operations.
 * Provides selection state and actions for bulk operations.
 */
export function useSelection<T extends string = string>(
  /** All selectable item IDs (used for "select all") */
  allIds: T[] = [],
) {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  // Clear selection when allIds changes (e.g., filter applied)
  useEffect(() => {
    // Remove any selected IDs that are no longer in the list
    setSelectedIds((prev) => {
      const allIdsSet = new Set(allIds);
      const filtered = new Set<T>();
      for (const id of prev) {
        if (allIdsSet.has(id)) {
          filtered.add(id);
        }
      }
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [allIds]);

  // Toggle a single item's selection
  const toggle = useCallback((id: T) => {
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

  // Check if an item is selected
  const isSelected = useCallback((id: T) => selectedIds.has(id), [selectedIds]);

  // Select all items
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allIds));
  }, [allIds]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Toggle all (select all if not all selected, otherwise clear)
  const toggleAll = useCallback(() => {
    if (selectedIds.size === allIds.length && allIds.length > 0) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [selectedIds.size, allIds.length, clearSelection, selectAll]);

  // Keyboard handler for Escape to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIds.size > 0) {
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds.size, clearSelection]);

  // Computed state
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const isAllSelected = allIds.length > 0 && selectedCount === allIds.length;
  const isPartiallySelected =
    selectedCount > 0 && selectedCount < allIds.length;

  // Get selected IDs as array (for iteration)
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    // State
    selectedIds,
    selectedArray,
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

export type SelectionState = ReturnType<typeof useSelection>;
