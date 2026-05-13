import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { MAX_HISTORY_ITEMS } from "@domainstack/constants";

interface SearchHistoryState {
  history: string[];
  hasHydrated: boolean;
}

interface SearchHistoryActions {
  addDomain: (domain: string) => void;
  removeDomain: (domain: string) => void;
  clearHistory: () => void;
}

type SearchHistoryStore = SearchHistoryState & SearchHistoryActions;

export const useSearchHistoryStore = create<SearchHistoryStore>()(
  persist(
    (set, get) => ({
      history: [],
      hasHydrated: false,

      addDomain: (domain) => {
        const currentHistory = get().history;

        if (currentHistory.length > 0 && currentHistory[0] === domain) {
          return;
        }

        const newHistory = [domain, ...currentHistory.filter((d) => d !== domain)].slice(
          0,
          MAX_HISTORY_ITEMS,
        );

        set({ history: newHistory });
      },

      removeDomain: (domain) => {
        set({ history: get().history.filter((d) => d !== domain) });
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "domainstack-native-search-history",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ history: state.history }),
      onRehydrateStorage: () => () => {
        useSearchHistoryStore.setState({ hasHydrated: true });
      },
    },
  ),
);
