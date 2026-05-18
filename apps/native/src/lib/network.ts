import { onlineManager } from "@tanstack/react-query";

// TanStack Query's `onlineManager` defaults to online=true until the first real
// network probe resolves (it is seeded asynchronously in api.tsx). A mutation
// fired in that cold-start window would bypass the friendly offline message and
// surface a raw fetch error instead. Treat "network state not yet known" as
// offline when guarding user-initiated actions.
let networkStateKnown = false;

/**
 * Thrown by {@link assertOnline} so callers (and the shared mutation error
 * handler) can distinguish a deliberate offline bail-out from a real request
 * failure and show a single friendly message instead of "<Action> failed: A
 * network connection is required for this action."
 */
export class OfflineError extends Error {
  constructor(message = "A network connection is required for this action.") {
    super(message);
    this.name = "OfflineError";
  }
}

/** `instanceof` is enough in a single bundle; the `name` check is belt-and-braces. */
export function isOfflineError(error: unknown): error is OfflineError {
  return error instanceof OfflineError || (error instanceof Error && error.name === "OfflineError");
}

/** Called once the first real `expo-network` reading has been applied. */
export function markNetworkStateKnown(): void {
  networkStateKnown = true;
}

export function assertOnline(): void {
  if (!networkStateKnown || !onlineManager.isOnline()) {
    throw new OfflineError();
  }
}
