import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { EmptyState } from "@/components/empty-state";

function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => onlineManager.subscribe(onStoreChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/**
 * Shared error state for failed data loads. Distinguishes a genuine offline
 * condition (own copy + reactive to reconnect) from a generic load failure,
 * and always offers a retry — no list screen should dead-end on a raw
 * `error.message`.
 */
export function QueryErrorState({
  onRetry,
  title = "Couldn’t load",
}: {
  onRetry: () => void;
  title?: string;
}) {
  const online = useIsOnline();

  if (!online) {
    return (
      <EmptyState
        actionLabel="Try again"
        body="You appear to be offline. Check your connection and try again."
        icon={{ android: "wifi_off", ios: "wifi.slash" }}
        onAction={onRetry}
        title="You’re offline"
      />
    );
  }

  return (
    <EmptyState
      actionLabel="Try again"
      body="Something went wrong while loading. Please try again."
      icon={{ android: "error_outline", ios: "exclamationmark.circle" }}
      onAction={onRetry}
      title={title}
    />
  );
}
