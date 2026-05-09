import { useMutation, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useState } from "react";

import { useTRPC } from "@/lib/api";
import { getPushPlatform, requestExpoPushToken } from "@/lib/push";

export function usePushRegistration() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"idle" | "requesting" | "denied" | "registered">("idle");

  const registerDevice = useMutation(
    trpc.user.registerPushDevice.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.user.getPushDevices.queryKey() });
      },
    }),
  );

  async function register() {
    setStatus("requesting");
    const result = await requestExpoPushToken();

    if (result.status !== "granted" || !result.expoPushToken) {
      setStatus("denied");
      return;
    }

    await registerDevice.mutateAsync({
      appVersion: Constants.expoConfig?.version ?? undefined,
      deviceName: result.deviceName ?? undefined,
      expoPushToken: result.expoPushToken,
      platform: getPushPlatform(),
    });
    setStatus("registered");
  }

  return {
    error: registerDevice.error,
    register,
    registering: status === "requesting" || registerDevice.isPending,
    status,
  };
}
