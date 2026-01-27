"use client";

import type { SortingState } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo, useRef } from "react";
import {
  DEFAULT_SORT,
  parseSortParam,
  SORT_OPTIONS,
  type SortOption,
  serializeSortState,
} from "@/lib/dashboard-utils";

/**
 * Hook to manage grid sort preference with URL persistence using nuqs.
 * Validates that sort option exists in SORT_OPTIONS (grid-compatible sorts only).
 * State preservation across intercepted routes is handled by Zustand store in dashboard-client.
 */
export function useDashboardGridSort(): [
  SortOption,
  (sort: SortOption) => void,
] {
  const [sortParam, setSortParam] = useQueryState(
    "sort",
    parseAsString.withDefault(DEFAULT_SORT).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );

  // Validate that the sort option is in SORT_OPTIONS (grid-compatible)
  const validSort = SORT_OPTIONS.some((opt) => opt.value === sortParam)
    ? (sortParam as SortOption)
    : DEFAULT_SORT;

  return [validSort, setSortParam];
}

/**
 * Hook for table view - syncs TanStack Table state with URL
 * Supports all sortable columns in the table.
 * State preservation across intercepted routes is handled by Zustand store in dashboard-client.
 *
 * @param onSortChange - Optional callback to run when sort changes (e.g., reset pagination)
 */
export function useDashboardTableSort(options?: {
  onSortChange?: () => void;
}): [
  SortingState,
  (updater: SortingState | ((old: SortingState) => SortingState)) => void,
] {
  // Store callback in ref to avoid recreating sort setter when callback changes
  const onSortChangeRef = useRef(options?.onSortChange);
  onSortChangeRef.current = options?.onSortChange;

  const [sortParam, setSortParam] = useQueryState(
    "sort",
    parseAsString.withDefault(DEFAULT_SORT).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );

  // Memoize sorting state to avoid creating new array on every render
  const sorting = useMemo(() => parseSortParam(sortParam), [sortParam]);

  const setSerializedSorting = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      const serialized = serializeSortState(newSorting);
      setSortParam(serialized);
      onSortChangeRef.current?.();
    },
    [sorting, setSortParam],
  );

  return [sorting, setSerializedSorting];
}
