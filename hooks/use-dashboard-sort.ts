"use client";

import type { SortingState } from "@tanstack/react-table";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  // Preserve state when navigating to intercepting routes (e.g. /dashboard/add-domain)
  const pathname = usePathname();
  const isDashboardPage = pathname === "/dashboard";
  const [cachedSort, setCachedSort] = useState(sortParam);

  useEffect(() => {
    if (isDashboardPage) {
      setCachedSort(sortParam);
    }
  }, [sortParam, isDashboardPage]);

  const activeSort = isDashboardPage ? sortParam : cachedSort;

  // Validate that the sort option is in SORT_OPTIONS (grid-compatible)
  const validSort = SORT_OPTIONS.some((opt) => opt.value === activeSort)
    ? (activeSort as SortOption)
    : DEFAULT_SORT;

  return [validSort, setSortParam];
}

/**
 * Hook for table view - syncs TanStack Table state with URL
 * Supports all sortable columns in the table
 *
 * @param onSortChange - Optional callback to run when sort changes (e.g., reset pagination)
 */
export function useDashboardTableSort(options?: {
  onSortChange?: () => void;
}): [
  SortingState,
  (updater: SortingState | ((old: SortingState) => SortingState)) => void,
] {
  const [sortParam, setSortParam] = useQueryState(
    "sort",
    parseAsString.withDefault(DEFAULT_SORT).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );

  // Preserve state when navigating to intercepting routes
  const pathname = usePathname();
  const isDashboardPage = pathname === "/dashboard";
  const [cachedSort, setCachedSort] = useState(sortParam);

  useEffect(() => {
    if (isDashboardPage) {
      setCachedSort(sortParam);
    }
  }, [sortParam, isDashboardPage]);

  const activeSort = isDashboardPage ? sortParam : cachedSort;

  // Memoize sorting state to avoid creating new array on every render
  const sorting = useMemo(() => parseSortParam(activeSort), [activeSort]);

  const setSerializedSorting = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      const serialized = serializeSortState(newSorting);
      setSortParam(serialized);
      options?.onSortChange?.();
    },
    [sorting, setSortParam, options],
  );

  return [sorting, setSerializedSorting];
}
