import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PushPromptTrigger = "signIn" | "firstDomain";

interface PushPromptState {
  handledTriggers: PushPromptTrigger[];
  isOpen: boolean;
  hasHydrated: boolean;
}

interface PushPromptActions {
  isTriggerHandled: (trigger: PushPromptTrigger) => boolean;
  markTriggerHandled: (trigger: PushPromptTrigger) => void;
  open: () => void;
  close: () => void;
  reset: () => void;
}

type PushPromptStore = PushPromptState & PushPromptActions;

export const usePushPromptStore = create<PushPromptStore>()(
  persist(
    (set, get) => ({
      handledTriggers: [],
      isOpen: false,
      hasHydrated: false,

      isTriggerHandled: (trigger) => get().handledTriggers.includes(trigger),
      markTriggerHandled: (trigger) =>
        set((state) =>
          state.handledTriggers.includes(trigger)
            ? state
            : { handledTriggers: [...state.handledTriggers, trigger] },
        ),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      reset: () => set({ handledTriggers: [], isOpen: false }),
    }),
    {
      name: "domainstack-native-push-prompt",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ handledTriggers: state.handledTriggers }),
      onRehydrateStorage: () => () => {
        usePushPromptStore.setState({ hasHydrated: true });
      },
    },
  ),
);
