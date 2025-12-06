"use client";

import { useCallback, useEffect, useState } from "react";

export type ViewMode = "grid" | "table";

const STORAGE_KEY = "dashboard-view-preference";
const DEFAULT_VIEW: ViewMode = "grid";

/**
 * Hook to manage dashboard view preference (grid vs table) with localStorage persistence.
 * Returns the current view mode and a setter function.
 */
export function useViewPreference(): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewModeState] = useState<ViewMode>(DEFAULT_VIEW);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "grid" || stored === "table") {
        setViewModeState(stored);
      }
    } catch {
      // localStorage not available (SSR or private browsing)
    }
    setIsHydrated(true);
  }, []);

  // Persist preference to localStorage when changed
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage not available
    }
  }, []);

  // Return default during SSR to prevent hydration mismatch
  return [isHydrated ? viewMode : DEFAULT_VIEW, setViewMode];
}
