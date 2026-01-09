"use client";

import { useCallback } from "react";
import useLocalStorageState from "use-local-storage-state";
import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  DASHBOARD_PREFERENCES_DEFAULT,
  DASHBOARD_PREFERENCES_STORAGE_KEY,
  DASHBOARD_VIEW_MODE_OPTIONS,
  type DashboardPageSizeOptions,
  type DashboardViewModeOptions,
} from "@/lib/dashboard-utils";

type DashboardPreferences = {
  viewMode: DashboardViewModeOptions;
  pageSize: DashboardPageSizeOptions;
  columnVisibility: Record<string, boolean>;
};

/**
 * Validates that a value is in the allowed options array.
 * Returns the value if valid, or the default if invalid.
 */
function validateOption<T>(
  value: T | undefined,
  validOptions: readonly T[],
  defaultValue: T,
): T {
  if (value !== undefined && validOptions.includes(value)) {
    return value;
  }
  return defaultValue;
}

/**
 * Hook to manage dashboard preferences with localStorage persistence.
 * Stores view mode (grid/table), page size, and column visibility in a single localStorage entry.
 *
 * Values are validated against allowed options to prevent invalid data from localStorage corruption.
 */
export function useDashboardPreferences(): DashboardPreferences & {
  setViewMode: (viewMode: DashboardViewModeOptions) => void;
  setPageSize: (pageSize: DashboardPageSizeOptions) => void;
  setColumnVisibility: (
    updaterOrValue:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
} {
  const defaultPreferences =
    DASHBOARD_PREFERENCES_DEFAULT as DashboardPreferences;
  const [preferences, setPreferences] =
    useLocalStorageState<DashboardPreferences>(
      DASHBOARD_PREFERENCES_STORAGE_KEY,
      {
        defaultValue: defaultPreferences,
      },
    );

  const setViewMode = useCallback(
    (viewMode: DashboardViewModeOptions) => {
      setPreferences((prev) => ({ ...prev, viewMode }));
    },
    [setPreferences],
  );

  const setPageSize = useCallback(
    (pageSize: DashboardPageSizeOptions) => {
      setPreferences((prev) => ({ ...prev, pageSize }));
    },
    [setPreferences],
  );

  const setColumnVisibility = useCallback(
    (
      updaterOrValue:
        | Record<string, boolean>
        | ((prev: Record<string, boolean>) => Record<string, boolean>),
    ) => {
      setPreferences((prev) => {
        const currentVisibility = prev.columnVisibility;
        const newVisibility =
          typeof updaterOrValue === "function"
            ? updaterOrValue(currentVisibility)
            : updaterOrValue;
        return { ...prev, columnVisibility: newVisibility };
      });
    },
    [setPreferences],
  );

  // Validate stored values to handle localStorage corruption
  const viewMode = validateOption<DashboardViewModeOptions>(
    preferences?.viewMode,
    DASHBOARD_VIEW_MODE_OPTIONS,
    defaultPreferences.viewMode,
  );

  const pageSize = validateOption<DashboardPageSizeOptions>(
    preferences?.pageSize,
    DASHBOARD_PAGE_SIZE_OPTIONS,
    defaultPreferences.pageSize,
  );

  return {
    viewMode,
    pageSize,
    columnVisibility:
      preferences?.columnVisibility ?? defaultPreferences.columnVisibility,
    setViewMode,
    setPageSize,
    setColumnVisibility,
  };
}
