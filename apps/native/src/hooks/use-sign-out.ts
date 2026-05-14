import { useMutation } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useCallback } from "react";

import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";

const UNREGISTER_TIMEOUT_MS = 3000;

export function useSignOut() {
  const trpc = useTRPC();
  const unregisterDevice = useMutation(trpc.user.unregisterPushDevice.mutationOptions());

  return useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (projectId) {
          const token = await Notifications.getExpoPushTokenAsync({ projectId });
          await Promise.race([
            unregisterDevice.mutateAsync({ expoPushToken: token.data }).catch(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, UNREGISTER_TIMEOUT_MS)),
          ]);
        }
      }
    } catch {
      // Best-effort: an offline or permission-stripped device should still sign out cleanly.
    }
    return authClient.signOut();
  }, [unregisterDevice]);
}
