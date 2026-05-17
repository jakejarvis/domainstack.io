import "@/global.css";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { Stack } from "expo-router/stack";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useCSSVariable } from "uniwind";

import { PushPermissionSheet } from "@/components/notifications/push-permission-sheet";
import { useVersionGateReady, VersionGate } from "@/components/version-gate";
import { useForegroundPushRefresh } from "@/hooks/use-foreground-push-refresh";
import { analytics } from "@/lib/analytics";
import { AnalyticsProvider } from "@/lib/analytics-provider";
import { ApiProvider } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { installGlobalErrorHandler } from "@/lib/error-handler";
import { configureImageCache } from "@/lib/image-cache";
import { routeFromNotificationData } from "@/lib/navigation";
import { useSearchHistoryStore } from "@/lib/stores/search-history-store";
import { toast } from "@/lib/toast";
import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";

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

  // Share Sheet → domain report. The OS hands us a URL/text via the iOS Share
  // Extension / Android intent filter; we extract a domain and route to its
  // (public) report. Independent of the notification routing above.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const addDomain = useSearchHistoryStore((s) => s.addDomain);
  const shareHandledRef = useRef(false);

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

  useEffect(() => {
    if (!hasShareIntent) return;
    if (shareHandledRef.current) return;
    shareHandledRef.current = true;

    // Prefer the library's pre-parsed `webUrl` (clean URL that
    // `normalizeDomainInput` handles perfectly). Free-form `text` must have a
    // URL extracted first (`normalizeDomainInput` can't strip surrounding
    // words), falling back to the raw text for bare-domain shares.
    const fromText = (() => {
      const t = shareIntent?.text ?? "";
      const m = t.match(/https?:\/\/[^\s<>"')]+/i);
      return m ? m[0] : t;
    })();
    const value = shareIntent?.webUrl || fromText;
    const domain = normalizeDomainInput(value);

    if (isValidDomain(domain)) {
      analytics.track("share_intent_received", { domain });
      addDomain(domain);
      router.push({ pathname: "/(tabs)/domains/[domain]", params: { domain } });
    } else {
      analytics.track("share_intent_invalid", { input: value });
      toast.warning({
        title: "Invalid link",
        message: "Couldn't find a domain in what you shared.",
      });
    }

    resetShareIntent();
    shareHandledRef.current = false;
  }, [hasShareIntent, shareIntent, resetShareIntent, addDomain]);

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
      <ShareIntentProvider options={{ resetOnBackground: true, debug: false }}>
        <AnalyticsProvider>
          <ApiProvider>
            <VersionGate>
              <RootNavigator />
            </VersionGate>
          </ApiProvider>
        </AnalyticsProvider>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}
