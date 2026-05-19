import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";

import { useTRPC } from "@/lib/api";
import { toast } from "@/lib/toast";
import { isVersionBelow } from "@/lib/version";
import type { RouterOutputs } from "@domainstack/api";

import { Button } from "./button";
import { Card } from "./card";
import { Screen } from "./screen";
import { Text } from "./text";

const STALE_TIME = 5 * 60 * 1000;
const READINESS_TIMEOUT_MS = 2000;

type NativeAppConfig = NonNullable<RouterOutputs["app"]["getConfig"]>;

function useNativeConfigQuery() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.app.getConfig.queryOptions(),
    staleTime: STALE_TIME,
  });
}

/**
 * Resolves true once the native-config query has settled (success or error —
 * the gate is fail-open) or after a 2s timeout so a hung request never holds
 * the splash forever. Splash hide gates on this.
 */
export function useVersionGateReady(): boolean {
  const nativeConfig = useNativeConfigQuery();
  const settled = !nativeConfig.isPending;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (settled) return;
    const id = setTimeout(() => setTimedOut(true), READINESS_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [settled]);

  return settled || timedOut;
}

export function VersionGate({ children }: { children: React.ReactNode }) {
  const nativeConfig = useNativeConfigQuery();

  const nativeApp = nativeConfig.data ?? null;
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

function UpdateRequiredScreen({ nativeApp }: { nativeApp: NativeAppConfig }) {
  const storeUrl = Platform.OS === "android" ? nativeApp.storeUrlAndroid : nativeApp.storeUrlIos;

  const openStore = () => {
    if (!storeUrl) {
      toast.error({
        title: "Update unavailable",
        message: "Please update Domainstack from the App Store or Play Store.",
      });
      return;
    }
    Linking.openURL(storeUrl).catch(() => {
      toast.error({
        title: "Couldn’t open the store",
        message: "Please update Domainstack manually from your app store.",
      });
    });
  };

  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center">
        <Card className="w-full max-w-md gap-4">
          <Text accessibilityRole="header" className="text-3xl font-semibold">
            {nativeApp.messageTitle ?? "Update required"}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {nativeApp.messageBody ??
              "Please update Domainstack to the latest version to continue."}
          </Text>
          <Button onPress={openStore}>
            <Text>Update Domainstack</Text>
          </Button>
        </Card>
      </View>
    </Screen>
  );
}
