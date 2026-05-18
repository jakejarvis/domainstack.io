import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { onHydrated } from "./persist-hydration";

interface PrivacyState {
  analyticsEnabled: boolean;
  errorCaptureEnabled: boolean;
  hasHydrated: boolean;
}

interface PrivacyActions {
  setAnalyticsEnabled: (value: boolean) => void;
  setErrorCaptureEnabled: (value: boolean) => void;
}

type PrivacyStore = PrivacyState & PrivacyActions;

export const usePrivacyStore = create<PrivacyStore>()(
  persist(
    (set) => ({
      analyticsEnabled: true,
      errorCaptureEnabled: true,
      hasHydrated: false,

      setAnalyticsEnabled: (analyticsEnabled) => set({ analyticsEnabled }),
      setErrorCaptureEnabled: (errorCaptureEnabled) => set({ errorCaptureEnabled }),
    }),
    {
      name: "domainstack-native-privacy",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        analyticsEnabled: state.analyticsEnabled,
        errorCaptureEnabled: state.errorCaptureEnabled,
      }),
      onRehydrateStorage: onHydrated(() => usePrivacyStore.setState({ hasHydrated: true })),
    },
  ),
);
