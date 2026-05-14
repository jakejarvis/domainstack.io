import { onlineManager } from "@tanstack/react-query";

export function assertOnline(): void {
  if (!onlineManager.isOnline()) {
    throw new Error("A network connection is required for this action.");
  }
}
