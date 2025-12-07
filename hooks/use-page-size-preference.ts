"use client";

import useLocalStorageState from "use-local-storage-state";

export type PageSize = 10 | 25 | 50 | 100;

export const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100];

const STORAGE_KEY = "dashboard-table-page-size";
const DEFAULT_PAGE_SIZE: PageSize = 25;

/**
 * Hook to manage table page size preference with localStorage persistence.
 * Returns the current page size and a setter function.
 */
export function usePageSizePreference(): [PageSize, (size: PageSize) => void] {
  const [pageSize, setPageSize] = useLocalStorageState<PageSize>(STORAGE_KEY, {
    defaultValue: DEFAULT_PAGE_SIZE,
  });

  return [pageSize, setPageSize];
}
