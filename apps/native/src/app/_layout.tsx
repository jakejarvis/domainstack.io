import "@/global.css";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { Stack } from "expo-router/stack";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
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

// Pin the tab navigator as the permanent base of the root stack. Without an
// anchor, redirect/`replace` flows (onboarding → sign-in, sign-out) can leave
// the `presentation: "modal"` sign-in screen as the stack root, which makes
// React Navigation render the whole app inside a stuck modal sheet.
export const unstable_settings = {
  anchor: "(tabs)",
};

void SplashScreen.preventAutoHideAsync();
installGlobalErrorHandler();
configureImageCache();

function RootNavigator() {
  const canvas = useCSSVariable("--color-background") as string;
  const surface = useCSSVariable("--color-glass") as string;
  const text = useCSSVariable("--color-foreground") as string;
  const isDark = useColorScheme() === "dark";
  const session = authClient.useSession();
  const isSignedIn = Boolean(session.data?.user);
  const versionGateReady = useVersionGateReady();
  useForegroundPushRefresh();

  // A killed-state tap on a protected target while signed-out is stashed here
  // and replayed once the user signs in, so the notification isn't lost.
  const pendingTargetRef = useRef<Href | null>(null);
  // The notification listener is subscribed once and never torn down; it reads
  // the latest auth-aware router through this ref so an auth flip can't open a
  // teardown/re-add gap that drops a foreground tap.
  const routeRef = useRef<(data: Record<string, unknown>) => void>(() => {});
  const coldStartHandledRef = useRef(false);

  useEffect(() => {
    if (!session.isPending && versionGateReady) {
      void SplashScreen.hideAsync();
    }
  }, [session.isPending, versionGateReady]);

  useEffect(() => {
    if (isSignedIn && pendingTargetRef.current) {
      const pending = pendingTargetRef.current;
      pendingTargetRef.current = null;
      router.push(pending);
    }
  }, [isSignedIn]);

  // Keep the router function current with the latest auth state without
  // resubscribing the listener below.
  useEffect(() => {
    routeRef.current = (data: Record<string, unknown>) => {
      const target = routeFromNotificationData(data);
      // Protected routes redirect to sign-in if there's no session; public
      // routes (domain reports) work fine signed-out. Stash the protected
      // target so it can be replayed after the user signs in instead of
      // being lost.
      if (!isSignedIn && target === "/(tabs)/notifications") {
        pendingTargetRef.current = target;
        router.push("/sign-in");
        return;
      }
      router.push(target);
    };
  }, [isSignedIn]);

  // Subscribe exactly once for the app's lifetime; the handler delegates to the
  // ref so it always sees the current auth state.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeRef.current(response.notification.request.content.data ?? {});
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Handle a cold-start tap once the session has settled — running it while
    // `isSignedIn` is still resolving would route a protected target to
    // /sign-in and the `clearLastNotificationResponse()` call would consume
    // the payload before it could be stashed/replayed.
    if (session.isPending || coldStartHandledRef.current) return;
    coldStartHandledRef.current = true;

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      routeRef.current(lastResponse.notification.request.content.data ?? {});
      Notifications.clearLastNotificationResponse();
    }
  }, [session.isPending]);

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
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, headerShown: false }} />
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
