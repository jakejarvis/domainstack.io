import { useMutation } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { usePushRegistration } from "@/hooks/use-push-registration";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";

const REFRESH_THROTTLE_MS = 60 * 60 * 1000;

export function useForegroundPushRefresh() {
  const session = authClient.useSession();
  const trpc = useTRPC();
  const { register } = usePushRegistration();
  const unregisterDevice = useMutation(trpc.user.unregisterPushDevice.mutationOptions());
  const isSignedIn = Boolean(session.data?.user);
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    if (!isSignedIn) return;

    const refresh = async () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
      lastRefreshRef.current = now;

      try {
        const { status } = await Notifications.getPermissionsAsync();
        const storedToken = usePushPromptStore.getState().lastRegisteredToken;

        if (status === "granted") {
          // Re-register: covers token rotation and re-grant-after-deny.
          await register();
        } else if (storedToken) {
          // Permission revoked at the OS level — clean up the now-dead row.
          await unregisterDevice.mutateAsync({ expoPushToken: storedToken }).catch(() => undefined);
          usePushPromptStore.getState().setLastRegisteredToken(null);
        }
      } catch {
        // Best-effort: refreshing must never block app usage.
      }
    };

    void refresh();

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh();
    });

    return () => subscription.remove();
  }, [isSignedIn, register, unregisterDevice]);
}
