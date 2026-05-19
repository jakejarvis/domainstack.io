import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Locale } from "@domainstack/i18n";

import { onHydrated } from "./persist-hydration";

interface LocaleState {
  /** Explicit user override. `null` means "follow the device locale". */
  locale: Locale | null;
  hasHydrated: boolean;
}

interface LocaleActions {
  setLocale: (locale: Locale | null) => void;
}

type LocaleStore = LocaleState & LocaleActions;

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: null,
      hasHydrated: false,

      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "domainstack-native-locale",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ locale: state.locale }),
      onRehydrateStorage: onHydrated(() => useLocaleStore.setState({ hasHydrated: true })),
    },
  ),
);
