"use client";

import type { SortingState } from "@tanstack/react-table";
import { usePathname } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";

/**
 * Sort option using table column format: "columnId.direction"
 * This keeps grid and table sorting perfectly aligned
 */
export type SortOption = `${string}.${"asc" | "desc"}`;

export type SortOptionConfig = {
  value: SortOption;
  label: string;
  shortLabel: string;
  direction: "asc" | "desc";
};

export const SORT_OPTIONS: SortOptionConfig[] = [
  {
    value: "domainName.asc",
    label: "Name (A-Z)",
    shortLabel: "Name",
    direction: "asc",
  },
  {
    value: "domainName.desc",
    label: "Name (Z-A)",
    shortLabel: "Name",
    direction: "desc",
  },
  {
    value: "expirationDate.asc",
    label: "Expiry (Soonest first)",
    shortLabel: "Expiry",
    direction: "asc",
  },
  {
    value: "expirationDate.desc",
    label: "Expiry (Furthest first)",
    shortLabel: "Expiry",
    direction: "desc",
  },
  {
    value: "createdAt.desc",
    label: "Recently added",
    shortLabel: "Added",
    direction: "desc",
  },
];

const DEFAULT_SORT: SortOption = "domainName.asc";

/**
 * Columns where unverified domains should NOT be pushed to the end.
 * For all other columns, unverified/pending domains will appear last.
 */
const COLUMNS_WITHOUT_VERIFICATION_SORT = new Set([
  "domainName",
  "verified",
  "createdAt",
]);

/**
 * Sort domains based on sort option (using table column format).
 * For columns other than domainName, verified, and createdAt,
 * unverified/pending domains are always pushed to the end of the list.
 */
export function sortDomains(
  domains: TrackedDomainWithDetails[],
  sortOption: SortOption,
): TrackedDomainWithDetails[] {
  const sorted = [...domains];
  const [columnId, direction] = sortOption.split(".") as [
    string,
    "asc" | "desc",
  ];
  const isDesc = direction === "desc";
  const pushUnverifiedToEnd = !COLUMNS_WITHOUT_VERIFICATION_SORT.has(columnId);

  switch (columnId) {
    case "domainName":
      sorted.sort((a, b) =>
        isDesc
          ? b.domainName.localeCompare(a.domainName)
          : a.domainName.localeCompare(b.domainName),
      );
      break;
    case "expirationDate":
      sorted.sort((a, b) => {
        // Push unverified domains to the end
        if (pushUnverifiedToEnd) {
          if (!a.verified && b.verified) return 1;
          if (a.verified && !b.verified) return -1;
        }
        // Put domains without expiry date at the end (among their verification group)
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return isDesc
          ? b.expirationDate.getTime() - a.expirationDate.getTime()
          : a.expirationDate.getTime() - b.expirationDate.getTime();
      });
      break;
    case "createdAt":
      sorted.sort((a, b) => {
        return isDesc
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime();
      });
      break;
  }

  return sorted;
}

/**
 * Parse sort string to TanStack Table SortingState
 * Format: "columnId.asc" or "columnId.desc"
 */
export function parseSortParam(sortParam: string): SortingState {
  const parts = sortParam.split(".");
  if (parts.length === 2) {
    const [columnId, direction] = parts;
    if (direction === "asc" || direction === "desc") {
      return [{ id: columnId, desc: direction === "desc" }];
    }
  }

  // Default fallback
  return [{ id: "domainName", desc: false }];
}

/**
 * Convert TanStack Table SortingState to sort string
 * Format: "columnId.asc" or "columnId.desc"
 */
export function serializeSortState(sorting: SortingState): string {
  if (sorting.length === 0) return DEFAULT_SORT;

  const first = sorting[0];
  return `${first.id}.${first.desc ? "desc" : "asc"}`;
}

/**
 * Hook to manage grid sort preference with URL persistence using nuqs.
 * Validates that sort option exists in SORT_OPTIONS (grid-compatible sorts only).
 */
export function useGridSortPreference(): [
  SortOption,
  (sort: SortOption) => void,
] {
  const [sortOption, setSortOption] = useQueryState(
    "sort",
    parseAsString.withDefault(DEFAULT_SORT).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );

  // Preserve state when navigating to intercepting routes (e.g. /dashboard/add-domain)
  const pathname = usePathname();
  const isDashboardPage = pathname === "/dashboard";
  const [cachedSortOption, setCachedSortOption] = useState(sortOption);

  useEffect(() => {
    if (isDashboardPage) {
      setCachedSortOption(sortOption);
    }
  }, [sortOption, isDashboardPage]);

  const activeSortOption = isDashboardPage ? sortOption : cachedSortOption;

  // Validate that the sort option is in SORT_OPTIONS (grid-compatible)
  const validSortOption = SORT_OPTIONS.some(
    (opt) => opt.value === activeSortOption,
  )
    ? (activeSortOption as SortOption)
    : DEFAULT_SORT;

  return [validSortOption, setSortOption];
}

/**
 * Hook for table view - syncs TanStack Table state with URL
 * Supports all sortable columns in the table
 *
 * @param onSortChange - Optional callback to run when sort changes (e.g., reset pagination)
 */
export function useTableSortPreference(options?: {
  onSortChange?: () => void;
}): {
  sorting: SortingState;
  setSorting: (
    updater: SortingState | ((old: SortingState) => SortingState),
  ) => void;
} {
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
  const [cachedSortParam, setCachedSortParam] = useState(sortParam);

  useEffect(() => {
    if (isDashboardPage) {
      setCachedSortParam(sortParam);
    }
  }, [sortParam, isDashboardPage]);

  const activeSortParam = isDashboardPage ? sortParam : cachedSortParam;

  // Memoize sorting state to avoid creating new array on every render
  const sorting = useMemo(
    () => parseSortParam(activeSortParam as string),
    [activeSortParam],
  );

  const setSorting = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      const serialized = serializeSortState(newSorting);
      setSortParam(serialized);
      options?.onSortChange?.();
    },
    [sorting, setSortParam, options],
  );

  return { sorting, setSorting };
}
