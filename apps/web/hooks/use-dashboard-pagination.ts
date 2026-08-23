import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef } from "react";

import { type DashboardPageSizeOptions, isPagePastEnd } from "@/lib/dashboard-utils";
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

export type DashboardFilterSignatureInput = {
  search: string;
  status: readonly string[];
  health: readonly string[];
  tlds: readonly string[];
  providers: readonly string[];
  domainId: string | null;
};

/** Stable key for filter URL state so pagination can reset after the user changes filters. */
export function getDashboardFilterSignature(filters: DashboardFilterSignatureInput): string {
  return JSON.stringify([
    filters.search,
    filters.status,
    filters.health,
    filters.tlds,
    filters.providers,
    filters.domainId,
  ]);
}

type SyncDashboardPageOptions = {
  itemCount: number;
  pageIndex: number;
  pageSize: number;
  filterSignature: string;
  resetPage: () => void;
};

/**
 * Keep the page in sync with filters:
 * - After the user changes filters, return to page 1 (skip the first paint so deep links stay).
 * - If the current page is past the last result, clamp to page 1.
 */
export function useSyncDashboardPage({
  itemCount,
  pageIndex,
  pageSize,
  filterSignature,
  resetPage,
}: SyncDashboardPageOptions): void {
  const previousSignature = useRef<string | null>(null);

  useEffect(() => {
    if (previousSignature.current === null) {
      previousSignature.current = filterSignature;
      return;
    }
    if (previousSignature.current === filterSignature) {
      return;
    }
    previousSignature.current = filterSignature;
    if (pageIndex > 0) {
      resetPage();
    }
  }, [filterSignature, pageIndex, resetPage]);

  useEffect(() => {
    if (isPagePastEnd(itemCount, pageIndex, pageSize)) {
      resetPage();
    }
  }, [itemCount, pageIndex, pageSize, resetPage]);
}
