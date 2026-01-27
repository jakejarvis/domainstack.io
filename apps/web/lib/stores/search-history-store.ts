"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_HISTORY_ITEMS } from "@/lib/constants/app";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchHistoryState {
  history: string[];
}

interface SearchHistoryActions {
  addDomain: (domain: string) => void;
  clearHistory: () => void;
}

type SearchHistoryStore = SearchHistoryState & SearchHistoryActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Search history store for recent domain lookups.
 *
 * Usage:
 * ```tsx
 * const history = useSearchHistoryStore((s) => s.history);
 * const addDomain = useSearchHistoryStore((s) => s.addDomain);
 * const clearHistory = useSearchHistoryStore((s) => s.clearHistory);
 * ```
 */
export const useSearchHistoryStore = create<SearchHistoryStore>()(
  persist(
    (set, get) => ({
      history: [],

      addDomain: (domain) => {
        const currentHistory = get().history;

        // Skip update if domain is already at the front
        if (currentHistory.length > 0 && currentHistory[0] === domain) {
          return;
        }

        // Create new list with domain at front, removing any duplicates
        const newHistory = [
          domain,
          ...currentHistory.filter((d) => d !== domain),
        ].slice(0, MAX_HISTORY_ITEMS);

        set({ history: newHistory });
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "search-history",
      version: 1,
      partialize: (state) => ({ history: state.history }),
    },
  ),
);
