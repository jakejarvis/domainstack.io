import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";

import { getOtaConfig, OTA_CONFIG_QUERY_KEY } from "@/lib/auth";
import { isVersionBelow } from "@/lib/version";
import type { OtaConfigNativeApp } from "@domainstack/auth/ota-config/client";

import { Button } from "./button";
import { GlassCard } from "./glass-card";
import { Screen } from "./screen";
import { Text } from "./text";

const STALE_TIME = 5 * 60 * 1000;
const READINESS_TIMEOUT_MS = 2000;

function useOtaConfigQuery() {
  return useQuery({
    queryFn: getOtaConfig,
    queryKey: OTA_CONFIG_QUERY_KEY,
    staleTime: STALE_TIME,
  });
}

/**
 * Resolves true once the OTA config query has settled (success or error — the
 * gate is fail-open) or after a 2s timeout so a hung config never holds the
 * splash forever. Splash hide gates on this.
 */
export function useVersionGateReady(): boolean {
  const otaConfig = useOtaConfigQuery();
  const settled = !otaConfig.isPending;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (settled) return;
    const id = setTimeout(() => setTimedOut(true), READINESS_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [settled]);

  return settled || timedOut;
}

export function VersionGate({ children }: { children: React.ReactNode }) {
  const otaConfig = useOtaConfigQuery();

  const nativeApp = otaConfig.data?.nativeApp ?? null;
  const currentVersion = Constants.expoConfig?.version;
  const shouldBlock =
    nativeApp !== null &&
    typeof currentVersion === "string" &&
    isVersionBelow(currentVersion, nativeApp.minVersion);

  if (shouldBlock) {
    return <UpdateRequiredScreen nativeApp={nativeApp} />;
  }

  return <>{children}</>;
}

function UpdateRequiredScreen({ nativeApp }: { nativeApp: OtaConfigNativeApp }) {
  const storeUrl = Platform.OS === "android" ? nativeApp.storeUrlAndroid : nativeApp.storeUrlIos;

  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center">
        <GlassCard className="w-full max-w-md gap-4">
          <Text className="text-3xl font-semibold">
            {nativeApp.messageTitle ?? "Update required"}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {nativeApp.messageBody ??
              "Please update Domainstack to the latest version to continue."}
          </Text>
          <Button onPress={() => void Linking.openURL(storeUrl)}>
            <Text>Update Domainstack</Text>
          </Button>
        </GlassCard>
      </View>
    </Screen>
  );
}
