"use client";

import { useSyncExternalStore } from "react";

/** Persist is missing during SSR when localStorage is unavailable — never read it at import time. */
export function usePersistHydration(store: {
  persist?: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: () => void) => () => void;
  };
}): boolean {
  return useSyncExternalStore(
    (onStoreChange) => store.persist?.onFinishHydration(onStoreChange) ?? (() => {}),
    () => store.persist?.hasHydrated() ?? false,
    () => false,
  );
}
