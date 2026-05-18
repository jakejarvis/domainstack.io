import { onlineManager } from "@tanstack/react-query";

// TanStack Query's `onlineManager` defaults to online=true until the first real
// network probe resolves (it is seeded asynchronously in api.tsx). A mutation
// fired in that cold-start window would bypass the friendly offline message and
// surface a raw fetch error instead. Treat "network state not yet known" as
// offline when guarding user-initiated actions.
let networkStateKnown = false;

/** Called once the first real `expo-network` reading has been applied. */
export function markNetworkStateKnown(): void {
  networkStateKnown = true;
}

export function assertOnline(): void {
  if (!networkStateKnown || !onlineManager.isOnline()) {
    throw new Error("A network connection is required for this action.");
  }
}
