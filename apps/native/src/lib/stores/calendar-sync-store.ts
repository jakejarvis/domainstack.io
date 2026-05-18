import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CalendarSyncState {
  /** Whether managed calendar sync is turned on for this device. */
  enabled: boolean;
  /** ID of the app-owned "Domainstack" calendar, once created. */
  calendarId: string | null;
  /** Maps `trackedDomainId` → native calendar event id for reconciliation. */
  eventMap: Record<string, string>;
  /** Epoch ms of the last successful reconcile (for the status row). */
  lastSyncedAt: number | null;
  hasHydrated: boolean;
}

interface CalendarSyncActions {
  setEnabled: (value: boolean) => void;
  setCalendarId: (value: string | null) => void;
  setEventMap: (value: Record<string, string>) => void;
  setLastSyncedAt: (value: number | null) => void;
  reset: () => void;
}

type CalendarSyncStore = CalendarSyncState & CalendarSyncActions;

const initialState: CalendarSyncState = {
  enabled: false,
  calendarId: null,
  eventMap: {},
  lastSyncedAt: null,
  hasHydrated: false,
};

export const useCalendarSyncStore = create<CalendarSyncStore>()(
  persist(
    (set) => ({
      ...initialState,

      setEnabled: (enabled) => set({ enabled }),
      setCalendarId: (calendarId) => set({ calendarId }),
      setEventMap: (eventMap) => set({ eventMap }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      // Keep `hasHydrated` so a reset mid-session doesn't re-block consumers.
      reset: () => set({ ...initialState, hasHydrated: true }),
    }),
    {
      name: "domainstack-native-calendar-sync",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        calendarId: state.calendarId,
        eventMap: state.eventMap,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => () => {
        useCalendarSyncStore.setState({ hasHydrated: true });
      },
    },
  ),
);
