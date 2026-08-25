"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * True after hydration. Uses `useSyncExternalStore` so the client/server
 * snapshot switch is a store update, not `setState` inside an effect.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
