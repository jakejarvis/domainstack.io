import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { usePushPromptStore } from "@/lib/stores/push-prompt-store";

export const UNREGISTER_TIMEOUT_MS = 3000;

export async function resolveTokenToUnregister(): Promise<string | null> {
  const stored = usePushPromptStore.getState().lastRegisteredToken;
  if (stored) return stored;

  // Fallback for sessions that registered before token tracking was added.
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

export function raceUnregister(
  promise: Promise<unknown>,
  timeoutMs: number = UNREGISTER_TIMEOUT_MS,
): Promise<void> {
  return Promise.race([
    promise.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
