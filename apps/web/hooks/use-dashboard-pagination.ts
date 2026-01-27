"use client";

import type { PaginationState } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback } from "react";
import type { DashboardPageSizeOptions } from "@/lib/dashboard-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";

/**
 * Hook for table pagination - syncs page index with URL, keeps page size in localStorage
 */
export function useDashboardPagination(): {
  pagination: PaginationState;
  pageSize: DashboardPageSizeOptions;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: DashboardPageSizeOptions) => void;
  resetPage: () => void;
} {
  // Page index in URL (1-indexed for user-facing URLs, converted to 0-indexed internally)
  const [pageParam, setPageParam] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );

  // Page size from preferences store
  const pageSize = usePreferencesStore((s) => s.pageSize);
  const setPageSizePreference = usePreferencesStore((s) => s.setPageSize);

  // Convert 1-indexed URL param to 0-indexed internal state
  const pageIndex = Math.max(0, pageParam - 1);

  const pagination: PaginationState = { pageIndex, pageSize };

  const setPageIndex = useCallback(
    (newIndex: number) => {
      // Convert 0-indexed internal state to 1-indexed URL param
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

  return {
    pagination,
    pageSize,
    setPageIndex,
    setPageSize,
    resetPage,
  };
}
