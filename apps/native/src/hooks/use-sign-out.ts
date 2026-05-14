import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { raceUnregister, resolveTokenToUnregister } from "@/lib/push-unregister";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";

export function useSignOut() {
  const trpc = useTRPC();
  const unregisterDevice = useMutation(trpc.user.unregisterPushDevice.mutationOptions());

  return useCallback(async () => {
    const token = await resolveTokenToUnregister();
    if (token) {
      await raceUnregister(unregisterDevice.mutateAsync({ expoPushToken: token }));
    }
    usePushPromptStore.getState().setLastRegisteredToken(null);
    return authClient.signOut();
  }, [unregisterDevice]);
}
