"use client";

import { useCallback } from "react";
import useLocalStorageState from "use-local-storage-state";

const STORAGE_KEY = "ai-preferences";

interface AiPreferences {
  showToolCalls: boolean;
  hideAiFeatures: boolean;
}

const defaultPreferences: AiPreferences = {
  showToolCalls: true,
  hideAiFeatures: false,
};

/**
 * Hook to manage AI feature preferences with localStorage persistence.
 * Uses use-local-storage-state for SSR safety and cross-tab sync.
 */
export function useAiPreferences() {
  const [preferences, setPreferences] = useLocalStorageState<AiPreferences>(
    STORAGE_KEY,
    { defaultValue: defaultPreferences },
  );

  const setShowToolCalls = useCallback(
    (show: boolean) => {
      setPreferences((prev) => ({ ...prev, showToolCalls: show }));
    },
    [setPreferences],
  );

  const setHideAiFeatures = useCallback(
    (hide: boolean) => {
      setPreferences((prev) => ({ ...prev, hideAiFeatures: hide }));
    },
    [setPreferences],
  );

  return {
    // Coalesce with defaults to handle existing localStorage missing new fields
    showToolCalls:
      preferences.showToolCalls ?? defaultPreferences.showToolCalls,
    setShowToolCalls,
    hideAiFeatures:
      preferences.hideAiFeatures ?? defaultPreferences.hideAiFeatures,
    setHideAiFeatures,
  };
}
