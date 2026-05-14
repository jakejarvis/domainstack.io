import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PortfolioSort, PortfolioStatusFilter } from "@/lib/portfolio";

type SelectionMode = "idle" | "selecting";
export type HealthBucket = "healthy" | "expiring" | "expired";

interface PortfolioState {
  query: string;
  sort: PortfolioSort;
  status: PortfolioStatusFilter;
  health: HealthBucket[];
  tlds: string[];
  hasHydrated: boolean;
  selection: {
    mode: SelectionMode;
    ids: Set<string>;
  };
}

interface PortfolioActions {
  setQuery: (query: string) => void;
  setSort: (sort: PortfolioSort) => void;
  setStatus: (status: PortfolioStatusFilter) => void;
  toggleHealth: (bucket: HealthBucket) => void;
  toggleTld: (tld: string) => void;
  resetFilters: () => void;
  enterSelection: (initialId?: string) => void;
  exitSelection: () => void;
  toggle: (id: string) => void;
  clear: () => void;
  selectAll: (ids: Iterable<string>) => void;
}

type PortfolioStore = PortfolioState & PortfolioActions;

const emptySelection: PortfolioState["selection"] = {
  ids: new Set<string>(),
  mode: "idle",
};

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set) => ({
      hasHydrated: false,
      health: [],
      query: "",
      selection: emptySelection,
      sort: "name",
      status: "all",
      tlds: [],

      setQuery: (query) => set({ query }),
      setSort: (sort) => set({ sort }),
      setStatus: (status) => set({ status }),

      toggleHealth: (bucket) =>
        set((state) => ({
          health: state.health.includes(bucket)
            ? state.health.filter((item) => item !== bucket)
            : [...state.health, bucket],
        })),

      toggleTld: (tld) =>
        set((state) => ({
          tlds: state.tlds.includes(tld)
            ? state.tlds.filter((item) => item !== tld)
            : [...state.tlds, tld],
        })),

      resetFilters: () => set({ health: [], status: "all", tlds: [] }),

      enterSelection: (initialId) =>
        set(() => {
          const ids = new Set<string>();
          if (initialId) ids.add(initialId);
          return { selection: { ids, mode: "selecting" } };
        }),

      exitSelection: () => set({ selection: { ids: new Set<string>(), mode: "idle" } }),

      toggle: (id) =>
        set((state) => {
          const ids = new Set(state.selection.ids);
          if (ids.has(id)) {
            ids.delete(id);
          } else {
            ids.add(id);
          }
          return { selection: { ...state.selection, ids } };
        }),

      clear: () =>
        set((state) => ({
          selection: { ...state.selection, ids: new Set<string>() },
        })),

      selectAll: (ids) =>
        set((state) => ({
          selection: { ...state.selection, ids: new Set(ids) },
        })),
    }),
    {
      name: "domainstack-native-portfolio",
      partialize: (state) => ({ sort: state.sort, status: state.status }),
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      onRehydrateStorage: () => () => {
        usePortfolioStore.setState({ hasHydrated: true });
      },
    },
  ),
);
