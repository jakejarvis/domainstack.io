import "@/global.css";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useCSSVariable } from "uniwind";

import { VersionGate } from "@/components/version-gate";
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

  useEffect(() => {
    if (!session.isPending) {
      void SplashScreen.hideAsync();
    }
  }, [session.isPending]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      router.push(routeFromNotificationData(response.notification.request.content.data ?? {}));
    });

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      router.push(routeFromNotificationData(lastResponse.notification.request.content.data ?? {}));
      Notifications.clearLastNotificationResponse();
    }

    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          animation: Platform.OS === "ios" ? "ios_from_right" : "slide_from_right",
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
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" options={{ presentation: "modal", title: "Sign in" }} />
        </Stack.Protected>
      </Stack>
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
