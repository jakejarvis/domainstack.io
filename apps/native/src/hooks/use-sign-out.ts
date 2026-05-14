import { useMutation } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useCallback } from "react";

import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";

const UNREGISTER_TIMEOUT_MS = 3000;

async function resolveTokenToUnregister(): Promise<string | null> {
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

export function useSignOut() {
  const trpc = useTRPC();
  const unregisterDevice = useMutation(trpc.user.unregisterPushDevice.mutationOptions());

  return useCallback(async () => {
    const token = await resolveTokenToUnregister();
    if (token) {
      await Promise.race([
        unregisterDevice.mutateAsync({ expoPushToken: token }).catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
      ]);
    }
    usePushPromptStore.getState().setLastRegisteredToken(null);
    return authClient.signOut();
  }, [unregisterDevice]);
}
