"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  DASHBOARD_PREFERENCES_DEFAULT,
  DASHBOARD_VIEW_MODE_OPTIONS,
  type DashboardPageSizeOptions,
  type DashboardViewModeOptions,
} from "@/lib/dashboard-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * AI mode preference for chat.
 * - cloud: Always use server-side AI (Gemini 2.5 Flash)
 * - local: Use browser-based AI (Gemini Nano/Phi Mini) when available
 * - auto: Prefer local AI when available, fall back to cloud
 */
export type AiModePreference = "cloud" | "local" | "auto";

const AI_MODE_OPTIONS = ["cloud", "local", "auto"] as const;

interface PreferencesState {
  // Dashboard preferences
  viewMode: DashboardViewModeOptions;
  pageSize: DashboardPageSizeOptions;
  columnVisibility: Record<string, boolean>;
  // AI preferences
  showToolCalls: boolean;
  showReasoning: boolean;
  hideAiFeatures: boolean;
  aiMode: AiModePreference;
}

interface PreferencesActions {
  setViewMode: (viewMode: DashboardViewModeOptions) => void;
  setPageSize: (pageSize: DashboardPageSizeOptions) => void;
  setColumnVisibility: (
    updaterOrValue:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  setShowToolCalls: (show: boolean) => void;
  setShowReasoning: (show: boolean) => void;
  setHideAiFeatures: (hide: boolean) => void;
  setAiMode: (mode: AiModePreference) => void;
}

type PreferencesStore = PreferencesState & PreferencesActions;

// ---------------------------------------------------------------------------
// Defaults & validation
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES: PreferencesState = {
  viewMode: DASHBOARD_PREFERENCES_DEFAULT.viewMode,
  pageSize: DASHBOARD_PREFERENCES_DEFAULT.pageSize,
  columnVisibility: DASHBOARD_PREFERENCES_DEFAULT.columnVisibility,
  showToolCalls: true,
  showReasoning: false,
  hideAiFeatures: false,
  aiMode: "cloud",
};

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

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Unified store for preferences local to the current browser, not the account.
 *
 * Usage:
 * ```tsx
 * const viewMode = usePreferencesStore((s) => s.viewMode);
 * const setViewMode = usePreferencesStore((s) => s.setViewMode);
 * ```
 */
const preferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PREFERENCES,

      setViewMode: (viewMode) => set({ viewMode }),
      setPageSize: (pageSize) => set({ pageSize }),
      setColumnVisibility: (updaterOrValue) => {
        const currentVisibility = get().columnVisibility;
        const newVisibility =
          typeof updaterOrValue === "function"
            ? updaterOrValue(currentVisibility)
            : updaterOrValue;
        set({ columnVisibility: newVisibility });
      },
      setShowToolCalls: (showToolCalls) => set({ showToolCalls }),
      setShowReasoning: (showReasoning) => set({ showReasoning }),
      setHideAiFeatures: (hideAiFeatures) => set({ hideAiFeatures }),
      setAiMode: (aiMode) => set({ aiMode }),
    }),
    {
      name: "preferences",
      version: 1,
      partialize: (state) => ({
        viewMode: state.viewMode,
        pageSize: state.pageSize,
        columnVisibility: state.columnVisibility,
        showToolCalls: state.showToolCalls,
        showReasoning: state.showReasoning,
        hideAiFeatures: state.hideAiFeatures,
        aiMode: state.aiMode,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PreferencesState> | null;
        return {
          ...currentState,
          viewMode: validateOption(
            persisted?.viewMode,
            DASHBOARD_VIEW_MODE_OPTIONS,
            DEFAULT_PREFERENCES.viewMode,
          ),
          pageSize: validateOption(
            persisted?.pageSize,
            DASHBOARD_PAGE_SIZE_OPTIONS,
            DEFAULT_PREFERENCES.pageSize,
          ),
          columnVisibility:
            persisted?.columnVisibility ?? DEFAULT_PREFERENCES.columnVisibility,
          showToolCalls:
            persisted?.showToolCalls ?? DEFAULT_PREFERENCES.showToolCalls,
          showReasoning:
            persisted?.showReasoning ?? DEFAULT_PREFERENCES.showReasoning,
          hideAiFeatures:
            persisted?.hideAiFeatures ?? DEFAULT_PREFERENCES.hideAiFeatures,
          aiMode: validateOption(
            persisted?.aiMode,
            AI_MODE_OPTIONS,
            DEFAULT_PREFERENCES.aiMode,
          ),
        };
      },
    },
  ),
);

export const usePreferencesStore = preferencesStore;

/**
 * Returns true once the preferences store has hydrated from localStorage.
 * Use this to prevent hydration mismatches when rendering based on persisted state.
 *
 * @see https://zustand.docs.pmnd.rs/integrations/persisting-store-data#how-can-i-check-if-my-store-has-been-hydrated
 */
export const usePreferencesHydrated = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = preferencesStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );

    setHydrated(preferencesStore.persist.hasHydrated());

    return () => unsubscribe();
  }, []);

  return hydrated;
};
