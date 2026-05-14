import { useMutation, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useCallback } from "react";

import { useTRPC } from "@/lib/api";
import { getPushPlatform, type PushRegistrationResult, requestExpoPushToken } from "@/lib/push";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";

export function usePushRegistration() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const registerDevice = useMutation(
    trpc.user.registerPushDevice.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.user.getPushDevices.queryKey() });
      },
    }),
  );

  const register = useCallback(async (): Promise<PushRegistrationResult["status"]> => {
    const result = await requestExpoPushToken();
    if (result.status !== "granted" || !result.expoPushToken) {
      return result.status;
    }
    await registerDevice.mutateAsync({
      appVersion: Constants.expoConfig?.version ?? undefined,
      deviceName: result.deviceName ?? undefined,
      expoPushToken: result.expoPushToken,
      platform: getPushPlatform(),
    });
    usePushPromptStore.getState().setLastRegisteredToken(result.expoPushToken);
    return "granted";
  }, [registerDevice]);

  return {
    error: registerDevice.error,
    register,
    registering: registerDevice.isPending,
  };
}
