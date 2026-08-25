"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useWebHaptics } from "web-haptics/react";

type Haptics = ReturnType<typeof useWebHaptics>;

const HapticsContext = createContext<Haptics | null>(null);

export function HapticsProvider({ children }: { children: ReactNode }) {
  const { trigger, cancel, isSupported } = useWebHaptics();
  const value = useMemo(() => ({ trigger, cancel, isSupported }), [trigger, cancel, isSupported]);

  return <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>;
}

export function useHaptics() {
  const haptics = useContext(HapticsContext);
  if (!haptics) {
    throw new Error("useHaptics must be used within HapticsProvider");
  }
  return haptics;
}
