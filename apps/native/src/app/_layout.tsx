import "@/global.css";
import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AnalyticsProvider } from "@/lib/analytics";
import { ApiProvider } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { routeFromNotificationData } from "@/lib/navigation";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
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

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      router.push(routeFromNotificationData(response.notification.request.content.data ?? {}));
      void Notifications.clearLastNotificationResponseAsync();
    });

    return () => subscription.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        animation: "ios_from_right",
        contentStyle: { backgroundColor: "#08110e" },
        headerBlurEffect: "systemChromeMaterialDark",
        headerLargeTitle: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "rgba(8, 17, 14, 0.78)" },
        headerTintColor: "#f6faf7",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" options={{ presentation: "modal", title: "Sign in" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1">
      <AnalyticsProvider>
        <ApiProvider>
          <RootNavigator />
        </ApiProvider>
      </AnalyticsProvider>
    </GestureHandlerRootView>
  );
}
