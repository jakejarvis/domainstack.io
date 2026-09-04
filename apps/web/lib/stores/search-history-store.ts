"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { usePersistHydration } from "@/lib/stores/persist-hydration";
import { MAX_HISTORY_ITEMS } from "@domainstack/constants";

interface SearchHistoryState {
  history: string[];
}

interface SearchHistoryActions {
  addDomain: (domain: string) => void;
  clearHistory: () => void;
}

type SearchHistoryStore = SearchHistoryState & SearchHistoryActions;

function parseHistory(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .slice(0, MAX_HISTORY_ITEMS);
}

const searchHistoryStore = create<SearchHistoryStore>()(
  persist(
    (set, get) => ({
      history: [],
      addDomain: (domain) => {
        const history = get().history;
        if (history[0] === domain) {
          return;
        }
        set({
          history: [domain, ...history.filter((item) => item !== domain)].slice(
            0,
            MAX_HISTORY_ITEMS,
          ),
        });
      },
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "search-history",
      version: 1,
      partialize: (state) => ({ history: state.history }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        history: parseHistory((persistedState as Partial<SearchHistoryState> | null)?.history),
      }),
    },
  ),
);

export const useSearchHistoryStore = searchHistoryStore;

/** Persisted history for UI. Empty until hydrate so SSR matches the first paint. */
export function useSearchHistory() {
  const history = useSearchHistoryStore((s) => s.history);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);
  const hydrated = usePersistHydration(searchHistoryStore);
  return {
    history: hydrated ? history : [],
    clearHistory,
    hydrated,
  };
}
