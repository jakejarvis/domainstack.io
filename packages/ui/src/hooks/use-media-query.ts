import { useCallback, useSyncExternalStore } from "react";

import { getClientReadySnapshot, subscribeClientReady } from "./client-ready";

/**
 * Subscribes to a media query. Returns `defaultValue` until after the first
 * client paint so the hydrate tree matches SSR.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  "use no memo";

  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubscribeReady = subscribeClientReady(callback);

      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return unsubscribeReady;
      }

      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", callback);

      return () => {
        unsubscribeReady();
        mediaQueryList.removeEventListener("change", callback);
      };
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (!getClientReadySnapshot()) {
      return defaultValue;
    }
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return defaultValue;
    }
    return window.matchMedia(query).matches;
  }, [defaultValue, query]);

  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
