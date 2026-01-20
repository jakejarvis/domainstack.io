"use client";

import { useCallback } from "react";
import useLocalStorageState from "use-local-storage-state";

const STORAGE_KEY = "ai-preferences";

interface AiPreferences {
  hideAiFeatures: boolean;
}

const defaultPreferences: AiPreferences = {
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

  const setHideAiFeatures = useCallback(
    (hide: boolean) => {
      setPreferences((prev) => ({ ...prev, hideAiFeatures: hide }));
    },
    [setPreferences],
  );

  return {
    hideAiFeatures: preferences.hideAiFeatures,
    setHideAiFeatures,
  };
}
