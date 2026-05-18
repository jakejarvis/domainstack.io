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
      // Must run while still authenticated — the RPC needs the auth cookie,
      // which `signOut()` is about to drop.
      await raceUnregister(unregisterDevice.mutateAsync({ expoPushToken: token }));
    }

    try {
      const result = await authClient.signOut();
      if (result?.error) {
        toast.error({
          title: "Sign out failed",
          message: result.error.message ?? "Please try again.",
        });
        return false;
      }
    } catch {
      toast.error({
        title: "Sign out failed",
        message: "You appear to be offline. Check your connection and try again.",
      });
      return false;
    }

    // Drop the token reference ONLY now that the session is actually gone.
    // Clearing it on a failed sign-out would orphan the server-side device row
    // (the token is the only handle needed to unregister it later); the user
    // stays signed in, so a retry — or the next foreground refresh — can still
    // reconcile it.
    usePushPromptStore.getState().setLastRegisteredToken(null);
    return true;
  }, [unregisterDevice]);
}
