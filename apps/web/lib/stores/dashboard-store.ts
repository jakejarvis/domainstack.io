"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  HealthFilter,
  SortOption,
  StatusFilter,
} from "@/lib/dashboard-utils";

/**
 * Snapshot of dashboard URL state to restore when returning from
 * intercepted routes like /dashboard/add-domain
 */
export interface FilterSnapshot {
  search: string;
  status: StatusFilter[];
  health: HealthFilter[];
  tlds: string[];
  providers: string[];
  domainId: string | null;
  sort: SortOption;
  page: number;
  view: "active" | "archived";
}

interface DashboardStore {
  // Snapshot state - persisted to sessionStorage
  snapshot: FilterSnapshot | null;
  captureSnapshot: (snapshot: FilterSnapshot) => void;
  clearSnapshot: () => void;
}

/**
 * Dashboard store for persisting state across intercepted route navigation.
 *
 * Uses sessionStorage so state survives navigation within a session
 * but is cleared when the browser tab closes.
 *
 * The dashboard-client automatically captures snapshots when navigating
 * away from /dashboard and restores them when returning.
 */
export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      snapshot: null,
      captureSnapshot: (snapshot) => set({ snapshot }),
      clearSnapshot: () => set({ snapshot: null }),
    }),
    {
      name: "dashboard-snapshot",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
