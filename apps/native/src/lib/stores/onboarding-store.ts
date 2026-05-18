import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { onHydrated } from "./persist-hydration";

interface OnboardingState {
  seen: boolean;
  hasHydrated: boolean;
}

interface OnboardingActions {
  markSeen: () => void;
}

type OnboardingStore = OnboardingState & OnboardingActions;

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      seen: false,
      hasHydrated: false,

      markSeen: () => set({ seen: true }),
    }),
    {
      name: "domainstack-native-onboarding",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ seen: state.seen }),
      onRehydrateStorage: onHydrated(() => useOnboardingStore.setState({ hasHydrated: true })),
    },
  ),
);
