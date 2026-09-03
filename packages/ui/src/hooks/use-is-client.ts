"use client";

import { useSyncExternalStore } from "react";

import {
  getClientReadyServerSnapshot,
  getClientReadySnapshot,
  subscribeClientReady,
} from "./client-ready";

/**
 * True after the first client paint. `getSnapshot` stays false until then so
 * hydrate matches SSR even if React reads the client snapshot.
 */
export function useIsClient(): boolean {
  "use no memo";
  return useSyncExternalStore(
    subscribeClientReady,
    getClientReadySnapshot,
    getClientReadyServerSnapshot,
  );
}
