"use client";

import useLocalStorageState from "use-local-storage-state";

export type ViewMode = "grid" | "table";

const STORAGE_KEY = "dashboard-view-preference";
const DEFAULT_VIEW: ViewMode = "grid";

/**
 * Hook to manage dashboard view preference (grid vs table) with localStorage persistence.
 * Returns the current view mode and a setter function.
 */
export function useViewPreference(): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewMode] = useLocalStorageState<ViewMode>(STORAGE_KEY, {
    defaultValue: DEFAULT_VIEW,
  });

  return [viewMode, setViewMode];
}
