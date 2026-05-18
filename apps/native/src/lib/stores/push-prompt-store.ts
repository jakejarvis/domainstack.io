import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { onHydrated } from "./persist-hydration";

export type PushPromptTrigger = "signIn" | "firstDomain";

interface PushPromptState {
  handledTriggers: PushPromptTrigger[];
  isOpen: boolean;
  hasHydrated: boolean;
  lastRegisteredToken: string | null;
}

interface PushPromptActions {
  isTriggerHandled: (trigger: PushPromptTrigger) => boolean;
  markTriggerHandled: (trigger: PushPromptTrigger) => void;
  open: () => void;
  close: () => void;
  reset: () => void;
  setLastRegisteredToken: (token: string | null) => void;
}

type PushPromptStore = PushPromptState & PushPromptActions;

export const usePushPromptStore = create<PushPromptStore>()(
  persist(
    (set, get) => ({
      handledTriggers: [],
      isOpen: false,
      hasHydrated: false,
      lastRegisteredToken: null,

      isTriggerHandled: (trigger) => get().handledTriggers.includes(trigger),
      markTriggerHandled: (trigger) =>
        set((state) =>
          state.handledTriggers.includes(trigger)
            ? state
            : { handledTriggers: [...state.handledTriggers, trigger] },
        ),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      reset: () => set({ handledTriggers: [], isOpen: false, lastRegisteredToken: null }),
      setLastRegisteredToken: (token) => set({ lastRegisteredToken: token }),
    }),
    {
      name: "domainstack-native-push-prompt",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        handledTriggers: state.handledTriggers,
        lastRegisteredToken: state.lastRegisteredToken,
      }),
      onRehydrateStorage: onHydrated(() => usePushPromptStore.setState({ hasHydrated: true })),
    },
  ),
);
