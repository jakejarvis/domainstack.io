import "@/global.css";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useCSSVariable } from "uniwind";

import { PushPermissionSheet } from "@/components/notifications/push-permission-sheet";
import { useVersionGateReady, VersionGate } from "@/components/version-gate";
import { useForegroundPushRefresh } from "@/hooks/use-foreground-push-refresh";
import { AnalyticsProvider } from "@/lib/analytics-provider";
import { ApiProvider } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { installGlobalErrorHandler } from "@/lib/error-handler";
import { configureImageCache } from "@/lib/image-cache";
import { routeFromNotificationData } from "@/lib/navigation";

void SplashScreen.preventAutoHideAsync();
installGlobalErrorHandler();
configureImageCache();

function RootNavigator() {
  const canvas = useCSSVariable("--color-canvas") as string;
  const surface = useCSSVariable("--color-glass") as string;
  const text = useCSSVariable("--color-text-primary") as string;
  const isDark = useColorScheme() === "dark";
  const session = authClient.useSession();
  const isSignedIn = Boolean(session.data?.user);
  const versionGateReady = useVersionGateReady();
  useForegroundPushRefresh();

  useEffect(() => {
    if (!session.isPending && versionGateReady) {
      void SplashScreen.hideAsync();
    }
  }, [session.isPending, versionGateReady]);

  useEffect(() => {
    const route = (data: Record<string, unknown>) => {
      const target = routeFromNotificationData(data);
      // Protected routes redirect to sign-in if there's no session; public routes
      // (domain reports) work fine signed-out.
      if (!isSignedIn && target === "/(tabs)/notifications") {
        router.push("/sign-in");
        return;
      }
      router.push(target);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      route(response.notification.request.content.data ?? {});
    });

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      route(lastResponse.notification.request.content.data ?? {});
      Notifications.clearLastNotificationResponse();
    }

    return () => subscription.remove();
  }, [isSignedIn]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          animation: "ios_from_right",
          contentStyle: { backgroundColor: canvas },
          headerBlurEffect: isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight",
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: surface },
          headerTintColor: text,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="settings" options={{ headerLargeTitle: true, title: "Settings" }} />
          <Stack.Screen
            name="delete-account"
            options={{ presentation: "formSheet", title: "Delete account" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" options={{ presentation: "modal", title: "Sign in" }} />
        </Stack.Protected>
      </Stack>
      <PushPermissionSheet />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AnalyticsProvider>
        <ApiProvider>
          <VersionGate>
            <RootNavigator />
          </VersionGate>
        </ApiProvider>
      </AnalyticsProvider>
    </GestureHandlerRootView>
  );
}
