"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  DASHBOARD_PREFERENCES_DEFAULT,
  DASHBOARD_VIEW_MODE_OPTIONS,
  type DashboardPageSizeOptions,
  type DashboardViewModeOptions,
} from "@/lib/dashboard-utils";
import { usePersistHydration } from "@/lib/stores/persist-hydration";

/** cloud = Vercel AI Gateway; local = browser model; auto = local with cloud fallback. */
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

const DEFAULT_PREFERENCES: PreferencesState = {
  viewMode: DASHBOARD_PREFERENCES_DEFAULT.viewMode,
  pageSize: DASHBOARD_PREFERENCES_DEFAULT.pageSize,
  columnVisibility: DASHBOARD_PREFERENCES_DEFAULT.columnVisibility,
  showToolCalls: true,
  showReasoning: false,
  hideAiFeatures: false,
  aiMode: "cloud",
};

function validateOption<T>(value: T | undefined, validOptions: readonly T[], defaultValue: T): T {
  if (value !== undefined && validOptions.includes(value)) {
    return value;
  }
  return defaultValue;
}

function parseColumnVisibility(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_PREFERENCES.columnVisibility };
  }
  const entries = Object.entries(value).filter(([, flag]) => typeof flag === "boolean");
  return {
    ...DEFAULT_PREFERENCES.columnVisibility,
    ...Object.fromEntries(entries),
  };
}

const preferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PREFERENCES,

      setViewMode: (viewMode) => set({ viewMode }),
      setPageSize: (pageSize) => set({ pageSize }),
      setColumnVisibility: (updaterOrValue) => {
        const currentVisibility = get().columnVisibility;
        const newVisibility =
          typeof updaterOrValue === "function" ? updaterOrValue(currentVisibility) : updaterOrValue;
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
          columnVisibility: parseColumnVisibility(persisted?.columnVisibility),
          showToolCalls: persisted?.showToolCalls ?? DEFAULT_PREFERENCES.showToolCalls,
          showReasoning: persisted?.showReasoning ?? DEFAULT_PREFERENCES.showReasoning,
          hideAiFeatures: persisted?.hideAiFeatures ?? DEFAULT_PREFERENCES.hideAiFeatures,
          aiMode: validateOption(persisted?.aiMode, AI_MODE_OPTIONS, DEFAULT_PREFERENCES.aiMode),
        };
      },
    },
  ),
);

export const usePreferencesStore = preferencesStore;

export const usePreferencesHydrated = () => usePersistHydration(preferencesStore);

function useHydratedPreference<T>(selector: (state: PreferencesStore) => T, ssrValue: T): T {
  const value = usePreferencesStore(selector);
  const hydrated = usePreferencesHydrated();
  return hydrated ? value : ssrValue;
}

export function useDashboardViewMode(): DashboardViewModeOptions {
  return useHydratedPreference((s) => s.viewMode, DEFAULT_PREFERENCES.viewMode);
}

export function useDashboardPageSize(): DashboardPageSizeOptions {
  return useHydratedPreference((s) => s.pageSize, DEFAULT_PREFERENCES.pageSize);
}

export function useDashboardColumnVisibility(): Record<string, boolean> {
  return useHydratedPreference((s) => s.columnVisibility, DEFAULT_PREFERENCES.columnVisibility);
}
