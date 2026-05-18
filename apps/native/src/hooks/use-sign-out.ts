import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { raceUnregister, resolveTokenToUnregister } from "@/lib/push-unregister";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";
import { toast } from "@/lib/toast";

/**
 * Signs the user out. Returns `true` only when the session was actually
 * revoked. Callers MUST gate navigation on the result — proceeding after a
 * failed sign-out (almost always offline) leaves the local session valid while
 * the UI pretends the user is signed out, so protected tabs stay reachable.
 *
 * On success, the active-user change is observed by `useResetCacheOnSignOut`
 * (api.tsx), which wipes the query cache and user-scoped stores.
 */
export function useSignOut() {
  const trpc = useTRPC();
  const unregisterDevice = useMutation(trpc.user.unregisterPushDevice.mutationOptions());

  return useCallback(async (): Promise<boolean> => {
    const token = await resolveTokenToUnregister();
    if (token) {
      await raceUnregister(unregisterDevice.mutateAsync({ expoPushToken: token }));
    }
    usePushPromptStore.getState().setLastRegisteredToken(null);

    try {
      const result = await authClient.signOut();
      if (result?.error) {
        toast.error({
          title: "Sign out failed",
          message: result.error.message ?? "Please try again.",
        });
        return false;
      }
      return true;
    } catch {
      toast.error({
        title: "Sign out failed",
        message: "You appear to be offline. Check your connection and try again.",
      });
      return false;
    }
  }, [unregisterDevice]);
}
