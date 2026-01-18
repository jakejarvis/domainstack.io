"use client";

import { useSyncExternalStore } from "react";

/**
 * Module-level singleton for the current time after hydration.
 * This ensures all components using useHydratedNow share the same value
 * and don't trigger separate state updates.
 */
let hydratedNow: Date | null = null;
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Date | null {
  return hydratedNow;
}

function getServerSnapshot(): Date | null {
  return null;
}

// Initialize on first client-side access
if (typeof window !== "undefined" && hydratedNow === null) {
  // Use microtask to ensure this runs after initial render
  queueMicrotask(() => {
    if (hydratedNow === null) {
      hydratedNow = new Date();
      // Notify all subscribers
      for (const listener of listeners) {
        listener();
      }
    }
  });
}

/**
 * Hook that returns the current time after hydration.
 * Returns null during SSR and before hydration completes.
 *
 * Unlike useState + useEffect pattern, this uses a module-level singleton
 * so all components share the same value and only one "re-render" cascade
 * happens after hydration, rather than N cascades for N components.
 *
 * @returns Date object after hydration, null before
 */
export function useHydratedNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
