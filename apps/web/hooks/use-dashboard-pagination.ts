import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback } from "react";
import type { DashboardPageSizeOptions } from "@/lib/dashboard-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardPaginationState {
  pageIndex: number;
  pageSize: DashboardPageSizeOptions;
}

export interface DashboardPaginationActions {
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: DashboardPageSizeOptions) => void;
  resetPage: () => void;
}

export interface UseDashboardPaginationReturn {
  state: DashboardPaginationState;
  actions: DashboardPaginationActions;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Encapsulates dashboard pagination state and logic.
 *
 * Manages:
 * - Page index via URL state (nuqs)
 * - Page size via localStorage preferences
 * - Reset page helper
 */
export function useDashboardPagination(): UseDashboardPaginationReturn {
  // URL state for page index (1-based in URL, converted to 0-based for TanStack Table)
  const [pageParam, setPageParam] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );

  // Page size from localStorage preferences
  const pageSize = usePreferencesStore((s) => s.pageSize);
  const setPageSizePreference = usePreferencesStore((s) => s.setPageSize);

  // Convert to 0-based index for TanStack Table
  const pageIndex = Math.max(0, pageParam - 1);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const setPageIndex = useCallback(
    (newIndex: number) => {
      setPageParam(newIndex + 1);
    },
    [setPageParam],
  );

  const setPageSize = useCallback(
    (newSize: DashboardPageSizeOptions) => {
      setPageSizePreference(newSize);
      // Reset to first page when changing page size
      setPageParam(1);
    },
    [setPageSizePreference, setPageParam],
  );

  const resetPage = useCallback(() => {
    setPageParam(1);
  }, [setPageParam]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    state: {
      pageIndex,
      pageSize,
    },
    actions: {
      setPageIndex,
      setPageSize,
      resetPage,
    },
  };
}
