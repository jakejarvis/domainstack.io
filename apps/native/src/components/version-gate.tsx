import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Linking, Platform, View } from "react-native";

import { Button } from "@/components/button";
import { GlassCard } from "@/components/glass-card";
import { Screen } from "@/components/screen";
import { MutedText, Text } from "@/components/text";
import { getOtaConfig, OTA_CONFIG_QUERY_KEY } from "@/lib/auth";
import { isVersionBelow } from "@/lib/version";
import type { OtaConfigNativeApp } from "@domainstack/auth/ota-config/client";

const STALE_TIME = 5 * 60 * 1000;

export function VersionGate({ children }: { children: React.ReactNode }) {
  const otaConfig = useQuery({
    queryFn: getOtaConfig,
    queryKey: OTA_CONFIG_QUERY_KEY,
    staleTime: STALE_TIME,
  });

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
          <MutedText>
            {nativeApp.messageBody ??
              "Please update Domainstack to the latest version to continue."}
          </MutedText>
          <Button onPress={() => void Linking.openURL(storeUrl)}>
            <Text>Update Domainstack</Text>
          </Button>
        </GlassCard>
      </View>
    </Screen>
  );
}
