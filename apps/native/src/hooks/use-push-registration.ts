import { useMutation, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useCallback } from "react";

import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { getPushPlatform, type PushRegistrationResult, requestExpoPushToken } from "@/lib/push";
import { usePushPromptStore } from "@/lib/stores/push-prompt-store";

/**
 * `register()` never throws — callers branch on this instead. `"error"` means
 * token acquisition or the server registration failed (already reported);
 * `"denied"`/`"undetermined"` reflect the OS permission outcome.
 */
export type PushRegisterOutcome = PushRegistrationResult["status"] | "error";

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
  const unregisterDevice = useMutation(trpc.user.unregisterPushDevice.mutationOptions());

  const register = useCallback(async (): Promise<PushRegisterOutcome> => {
    let result: PushRegistrationResult;
    try {
      result = await requestExpoPushToken();
    } catch (error) {
      // Token acquisition (Expo / APNs / FCM) is not a tRPC mutation, so it
      // bypasses the global mutation-cache reporter — a failure here would
      // otherwise be a totally silent dead end for a core feature. Report once.
      analytics.trackException(error, { context: "push_token" });
      return "error";
    }

    if (result.status !== "granted" || !result.expoPushToken) {
      return result.status;
    }

    try {
      await registerDevice.mutateAsync({
        appVersion: Constants.expoConfig?.version ?? undefined,
        deviceName: result.deviceName ?? undefined,
        deviceModel: result.deviceModel ?? undefined,
        deviceType: result.deviceType ?? undefined,
        manufacturer: result.manufacturer ?? undefined,
        osName: result.osName ?? undefined,
        osVersion: result.osVersion ?? undefined,
        expoPushToken: result.expoPushToken,
        platform: getPushPlatform(),
      });
    } catch {
      // Already reported centrally (mutationCache.onError) and surfaced via
      // `registerDevice.error` — don't double-report, just signal failure.
      return "error";
    }

    // Token rotated (OS restore / APNs↔FCM refresh): the new token is now
    // registered, so drop the stale device row. Otherwise push dispatch fans
    // out to a dead duplicate until Expo eventually reports DeviceNotRegistered,
    // and Settings shows a phantom device. Best-effort — never block on it.
    const previousToken = usePushPromptStore.getState().lastRegisteredToken;
    if (previousToken && previousToken !== result.expoPushToken) {
      await unregisterDevice.mutateAsync({ expoPushToken: previousToken }).catch(() => undefined);
    }
    usePushPromptStore.getState().setLastRegisteredToken(result.expoPushToken);
    return "granted";
  }, [registerDevice, unregisterDevice]);

  return {
    error: registerDevice.error,
    register,
    registering: registerDevice.isPending,
  };
}
