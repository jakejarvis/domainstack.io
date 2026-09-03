"use client";

import { useSyncExternalStore } from "react";

/**
 * Module-level singleton for the current time after hydration.
 * This ensures all components using useHydratedNow share the same value
 * and don't trigger separate state updates.
 */
let hydratedNow: Date | null = null;
const listeners = new Set<() => void>();
let cancelPendingInitializer: (() => void) | null = null;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  // Start the clock after the first paint, not at module evaluation.
  // A module-level microtask can run before hydrateRoot, so getSnapshot()
  // would return a Date while the server HTML still has the placeholder.
  if (typeof window !== "undefined" && hydratedNow === null && cancelPendingInitializer === null) {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      cancelPendingInitializer = null;
      if (cancelled || hydratedNow !== null) {
        return;
      }
      hydratedNow = new Date();
      for (const listener of listeners) {
        listener();
      }
    });
    cancelPendingInitializer = () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }

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
  "use no memo";
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Test-only: pin or clear the shared clock so suites do not leak wall time. */
export function resetHydratedNow(date: Date | null = new Date()): void {
  cancelPendingInitializer?.();
  cancelPendingInitializer = null;
  hydratedNow = date ? new Date(date.getTime()) : null;
  for (const listener of listeners) {
    listener();
  }
}
