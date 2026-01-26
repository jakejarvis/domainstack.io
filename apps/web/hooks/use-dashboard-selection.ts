"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook for managing multi-select state with O(1) operations.
 * Provides selection state and actions for bulk operations.
 *
 * Supports pagination-aware selection:
 * - `allIds`: All selectable item IDs
 * - `visibleIds`: Currently visible item IDs (for pagination). Defaults to allIds.
 * - `toggleAll` operates on visible items only
 * - Selection persists across page changes
 */
export function useDashboardSelection<T extends string = string>(
  /** All selectable item IDs */
  allIds: T[] = [],
  /** Currently visible item IDs (defaults to allIds). Used for pagination-aware "select all". */
  visibleIds?: T[],
) {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(() => new Set());

  // Use visibleIds if provided, otherwise default to allIds
  const effectiveVisibleIds = visibleIds ?? allIds;

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

  // Select all visible items
  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of effectiveVisibleIds) {
        next.add(id);
      }
      return next;
    });
  }, [effectiveVisibleIds]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Toggle all visible items (select all visible if not all visible selected, otherwise clear visible)
  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allVisibleSelected = effectiveVisibleIds.every((id) =>
        prev.has(id),
      );

      if (allVisibleSelected && effectiveVisibleIds.length > 0) {
        // Deselect all visible items
        const next = new Set(prev);
        for (const id of effectiveVisibleIds) {
          next.delete(id);
        }
        return next;
      }
      // Select all visible items
      const next = new Set(prev);
      for (const id of effectiveVisibleIds) {
        next.add(id);
      }
      return next;
    });
  }, [effectiveVisibleIds]);

  // Keyboard handler for Escape to clear selection
  // Use ref to avoid re-attaching listener on every selection change
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

  // Computed state - based on visible items for pagination support
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  // Check if all visible items are selected (for checkbox indeterminate state)
  const visibleSelectedCount = effectiveVisibleIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const isAllSelected =
    effectiveVisibleIds.length > 0 &&
    visibleSelectedCount === effectiveVisibleIds.length;
  const isPartiallySelected =
    visibleSelectedCount > 0 &&
    visibleSelectedCount < effectiveVisibleIds.length;

  // Get selected IDs as array (for iteration)
  const selectedArray = Array.from(selectedIds);

  return {
    // State
    selectedIds,
    selectedArray,
    selectedCount,
    hasSelection,
    isAllSelected,
    isPartiallySelected,
    visibleSelectedCount,

    // Actions
    toggle,
    isSelected,
    selectAll,
    clearSelection,
    toggleAll,
  };
}

export type SelectionState = ReturnType<typeof useDashboardSelection>;
