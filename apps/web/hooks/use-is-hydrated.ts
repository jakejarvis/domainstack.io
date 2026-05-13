"use client";

import { useSyncExternalStore } from "react";

function emptySubscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

/**
 * Returns false during SSR and the first render after hydration, then true.
 *
 * Use this instead of the `useState(false)` + `useEffect(() => setX(true), [])`
 * pattern to gate client-only content. It commits the client value in a single
 * render via useSyncExternalStore's split server/client snapshot.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}
