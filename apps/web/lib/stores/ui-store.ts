"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useIsClient } from "@/hooks/use-is-client";

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

const subscribeUiHydration = uiStore.persist.onFinishHydration;
const getUiHydrationSnapshot = () => uiStore.persist.hasHydrated();
const getUiHydrationServerSnapshot = () => false;

export const useUiHydrated = () =>
  useSyncExternalStore(subscribeUiHydration, getUiHydrationSnapshot, getUiHydrationServerSnapshot);

/**
 * Dismissed only after hydration so SSR and the first client paint match
 * (pill visible). Previously dismissed users hide it on the next frame.
 */
export function useAnnouncementDismissed(): boolean {
  const dismissed = useUiStore((s) => s.announcementDismissed);
  const hydrated = useUiHydrated();
  const isClient = useIsClient();
  return isClient && hydrated && dismissed;
}
