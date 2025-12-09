"use client";

import useLocalStorageState from "use-local-storage-state";

export type ViewMode = "grid" | "table";
export type PageSize = 10 | 25 | 50 | 100;
export type ColumnVisibility = Record<string, boolean>;

export const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100];

type DashboardPreferences = {
  viewMode: ViewMode;
  pageSize: PageSize;
  columnVisibility: ColumnVisibility;
};

const STORAGE_KEY = "dashboard-preferences";
const DEFAULT_PREFERENCES: DashboardPreferences = {
  viewMode: "grid",
  pageSize: 25,
  columnVisibility: {}, // Empty means all columns visible (default)
};

/**
 * Hook to manage dashboard preferences with localStorage persistence.
 * Stores view mode (grid/table), page size, and column visibility in a single localStorage entry.
 *
 * This hook consolidates all dashboard-related localStorage preferences
 * to avoid multiple storage keys and provide a consistent API.
 */
export function useDashboardPreferences() {
  const [preferences, setPreferences] =
    useLocalStorageState<DashboardPreferences>(STORAGE_KEY, {
      defaultValue: DEFAULT_PREFERENCES,
    });

  const setViewMode = (viewMode: ViewMode) => {
    setPreferences((prev) => ({ ...prev, viewMode }));
  };

  const setPageSize = (pageSize: PageSize) => {
    setPreferences((prev) => ({ ...prev, pageSize }));
  };

  const setColumnVisibility = (columnVisibility: ColumnVisibility) => {
    setPreferences((prev) => ({ ...prev, columnVisibility }));
  };

  return {
    viewMode: preferences?.viewMode ?? DEFAULT_PREFERENCES.viewMode,
    pageSize: preferences?.pageSize ?? DEFAULT_PREFERENCES.pageSize,
    columnVisibility:
      preferences?.columnVisibility ?? DEFAULT_PREFERENCES.columnVisibility,
    setViewMode,
    setPageSize,
    setColumnVisibility,
  };
}

/**
 * Convenience hook for components that only need view mode preference.
 * Returns a tuple for backward compatibility with useViewPreference.
 */
export function useViewPreference(): [ViewMode, (mode: ViewMode) => void] {
  const { viewMode, setViewMode } = useDashboardPreferences();
  return [viewMode, setViewMode];
}

/**
 * Convenience hook for components that only need page size preference.
 * Returns a tuple for backward compatibility with usePageSizePreference.
 */
export function usePageSizePreference(): [PageSize, (size: PageSize) => void] {
  const { pageSize, setPageSize } = useDashboardPreferences();
  return [pageSize, setPageSize];
}

/**
 * Convenience hook for components that only need column visibility preference.
 * Returns a setter compatible with TanStack Table's onColumnVisibilityChange
 * (accepts both direct values and updater functions).
 */
export function useColumnVisibilityPreference(): [
  ColumnVisibility,
  (
    updaterOrValue:
      | ColumnVisibility
      | ((prev: ColumnVisibility) => ColumnVisibility),
  ) => void,
] {
  const { columnVisibility, setColumnVisibility } = useDashboardPreferences();

  const setVisibility = (
    updaterOrValue:
      | ColumnVisibility
      | ((prev: ColumnVisibility) => ColumnVisibility),
  ) => {
    if (typeof updaterOrValue === "function") {
      // Handle updater function pattern (TanStack Table uses this)
      const newValue = updaterOrValue(columnVisibility);
      setColumnVisibility(newValue);
    } else {
      // Handle direct value pattern
      setColumnVisibility(updaterOrValue);
    }
  };

  return [columnVisibility, setVisibility];
}
