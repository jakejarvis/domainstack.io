"use client";

import type { PaginationState } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import {
  type PageSize,
  usePageSizePreference,
} from "@/hooks/use-dashboard-preferences";

/**
 * Hook for table pagination - syncs page index with URL, keeps page size in localStorage
 */
export function useTablePagination(): {
  pagination: PaginationState;
  pageSize: PageSize;
  setPageIndex: (pageIndex: number) => void;
  setPageSize: (pageSize: PageSize) => void;
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

  // Page size in localStorage
  const [pageSize, setPageSizePreference] = usePageSizePreference();

  // Convert 1-indexed URL param to 0-indexed internal state
  const pageIndex = Math.max(0, pageParam - 1);

  const pagination: PaginationState = {
    pageIndex,
    pageSize,
  };

  const setPageIndex = (newIndex: number) => {
    // Convert 0-indexed internal state to 1-indexed URL param
    setPageParam(newIndex + 1);
  };

  const setPageSize = (newSize: PageSize) => {
    setPageSizePreference(newSize);
    // Reset to first page when changing page size
    setPageParam(1);
  };

  const resetPage = () => {
    setPageParam(1);
  };

  return {
    pagination,
    pageSize,
    setPageIndex,
    setPageSize,
    resetPage,
  };
}
