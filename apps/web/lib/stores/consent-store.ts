"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { usePersistHydration } from "@/lib/stores/persist-hydration";

const CONSENT_KEY = "cookie-consent";
const CONSENT_STATUSES = ["pending", "accepted", "declined"] as const;

export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

interface ConsentState {
  consent: ConsentStatus;
}

interface ConsentActions {
  setConsent: (consent: ConsentStatus) => void;
}

type ConsentStore = ConsentState & ConsentActions;

type ConsentPersistValue = { state: Pick<ConsentState, "consent">; version: number };

function isConsentStatus(value: unknown): value is ConsentStatus {
  return typeof value === "string" && CONSENT_STATUSES.includes(value as ConsentStatus);
}

/** True when the last localStorage read/write succeeded. */
let storagePersistent = false;

/** Lifts a legacy raw `"accepted"` / `"declined"` string into persist shape. */
const consentLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      const raw = localStorage.getItem(name);
      storagePersistent = true;
      if (raw === null) {
        return null;
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        if (isConsentStatus(parsed)) {
          const migrated: ConsentPersistValue = { state: { consent: parsed }, version: 1 };
          return JSON.stringify(migrated);
        }
      } catch {
        return raw;
      }

      return raw;
    } catch {
      storagePersistent = false;
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
      storagePersistent = true;
    } catch {
      storagePersistent = false;
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      storagePersistent = false;
    }
  },
};

const consentStore = create<ConsentStore>()(
  persist(
    (set) => ({
      consent: "pending",
      setConsent: (consent) => set({ consent }),
    }),
    {
      name: CONSENT_KEY,
      version: 1,
      storage: createJSONStorage(() => consentLocalStorage),
      partialize: (state) => ({ consent: state.consent }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ConsentState> | null;
        return {
          ...currentState,
          consent: isConsentStatus(persisted?.consent) ? persisted.consent : currentState.consent,
        };
      },
    },
  ),
);

export const useConsentStore = consentStore;

export function useConsent() {
  const consent = useConsentStore((s) => s.consent);
  const setConsent = useConsentStore((s) => s.setConsent);
  return {
    consent,
    setConsent,
    persistent: usePersistHydration(consentStore) && storagePersistent,
  };
}
