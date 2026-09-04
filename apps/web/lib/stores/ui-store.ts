"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { usePersistHydration } from "@/lib/stores/persist-hydration";

interface UiState {
  announcementDismissed: boolean;
}

interface UiActions {
  dismissAnnouncement: () => void;
}

type UiStore = UiState & UiActions;

const uiStore = create<UiStore>()(
  persist(
    (set) => ({
      announcementDismissed: false,
      dismissAnnouncement: () => set({ announcementDismissed: true }),
    }),
    {
      name: "ui",
      version: 1,
      partialize: (state) => ({ announcementDismissed: state.announcementDismissed }),
    },
  ),
);

export const useUiStore = uiStore;

/** Hidden until persist hydrates so dismissed users never see a flash. */
export function useAnnouncement() {
  const dismissed = useUiStore((s) => s.announcementDismissed);
  const dismiss = useUiStore((s) => s.dismissAnnouncement);
  return {
    visible: usePersistHydration(uiStore) && !dismissed,
    dismiss,
  };
}
