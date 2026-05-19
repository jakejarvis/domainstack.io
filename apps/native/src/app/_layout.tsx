// MUST be first: installs the FormatJS Intl polyfills before any formatter runs.
import "@/lib/intl-polyfill";
import "@/global.css";
import { I18nProvider } from "@lingui/react";
import * as Notifications from "expo-notifications";
import * as QuickActions from "expo-quick-actions";
import { type RouterAction, useQuickActionRouting } from "expo-quick-actions/router";
import { type Href, router } from "expo-router";
import { Stack } from "expo-router/stack";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { PushPermissionSheet } from "@/components/notifications/push-permission-sheet";
import { RootErrorBoundary } from "@/components/root-error-boundary";
import { useVersionGateReady, VersionGate } from "@/components/version-gate";
import { useCalendarSync } from "@/hooks/use-calendar-sync";
import { useForegroundPushRefresh } from "@/hooks/use-foreground-push-refresh";
import { analytics } from "@/lib/analytics";
import { AnalyticsProvider } from "@/lib/analytics-provider";
import { ApiProvider } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { installGlobalErrorHandler } from "@/lib/error-handler";
import { deviceLocale, loadCatalog } from "@/lib/i18n";
import { configureImageCache } from "@/lib/image-cache";
import { NOTIFICATIONS_ROUTE, routeFromNotificationData } from "@/lib/navigation";
import { useStackScreenOptions } from "@/lib/screen-options";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useSearchHistoryStore } from "@/lib/stores/search-history-store";
import { toast } from "@/lib/toast";
import { i18n } from "@domainstack/i18n";
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
  const screenOptions = useStackScreenOptions();
  const isDark = useColorScheme() === "dark";
  const session = authClient.useSession();
  const isSignedIn = Boolean(session.data?.user);
  const versionGateReady = useVersionGateReady();
  useForegroundPushRefresh();
  useCalendarSync();

  const localeOverride = useLocaleStore((s) => s.locale);
  const localeHydrated = useLocaleStore((s) => s.hasHydrated);
  const [i18nReady, setI18nReady] = useState(false);

  // Activate the Lingui catalog for the effective locale (explicit override,
  // else device locale). Re-runs when the user changes language so the UI
  // switches live. Waits for the persisted override to hydrate first to avoid
  // a flash of the device locale.
  useEffect(() => {
    if (!localeHydrated) return;
    let cancelled = false;
    void loadCatalog(localeOverride ?? deviceLocale()).finally(() => {
      if (!cancelled) setI18nReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [localeHydrated, localeOverride]);

  // Home-screen long-press shortcuts. `useQuickActionRouting()` navigates to
  // `params.href` on cold start (initial action) and while backgrounded; the
  // effect registers the items. iOS renders the `symbol:` SF Symbols; Android
  // ignores them and falls back to the system default icon.
  useQuickActionRouting();
  useEffect(() => {
    void QuickActions.setItems<RouterAction>([
      {
        id: "search",
        title: "Search",
        icon: "symbol:magnifyingglass",
        params: { href: "/(tabs)/search" },
      },
      {
        id: "portfolio",
        title: "Portfolio",
        icon: "symbol:globe",
        params: { href: "/(tabs)/domains" },
      },
      {
        id: "notifications",
        title: "Notifications",
        icon: "symbol:bell",
        params: { href: "/(tabs)/notifications" },
      },
    ]);
  }, []);

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
  const lastShareSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session.isPending && versionGateReady && i18nReady) {
      void SplashScreen.hideAsync();
    }
  }, [session.isPending, versionGateReady, i18nReady]);

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
      try {
        const target = routeFromNotificationData(data);
        analytics.track("notification_opened", {
          route: typeof target === "string" ? target : target.pathname,
        });
        // Protected routes redirect to sign-in if there's no session; public
        // routes (domain reports) work fine signed-out. Stash the protected
        // target so it can be replayed after the user signs in instead of
        // being lost.
        if (!isSignedIn && target === NOTIFICATIONS_ROUTE) {
          pendingTargetRef.current = target;
          router.push("/sign-in");
          return;
        }
        router.push(target);
      } catch (error) {
        // This runs from a notification-listener callback / cold-start effect,
        // not a React render — an error boundary can't catch it. A malformed
        // payload or a router failure must not bubble into an unhandled
        // rejection; report it and stay put.
        analytics.trackException(error, { context: "notification_route" });
      }
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
    const signature = value || "";

    // Only act once per distinct shared payload. `resetShareIntent()` mutates
    // context and retriggers this effect, and the OS can re-deliver the same
    // intent; a synchronously-cleared ref guard is a no-op, a payload
    // signature is not. We still clear the intent on every run so a duplicate
    // or empty delivery can't wedge the effect.
    const alreadyHandled = signature !== "" && lastShareSignatureRef.current === signature;
    if (!alreadyHandled) {
      lastShareSignatureRef.current = signature;
      const domain = normalizeDomainInput(value);

      if (isValidDomain(domain)) {
        analytics.track("share_intent_received", { domain });
        addDomain(domain);
        router.push({ pathname: "/(tabs)/domains/[domain]", params: { domain } });
      } else {
        analytics.track("share_intent_invalid", { input: value });
        toast.warning({
          title: "Invalid link",
          message: "Couldn’t find a domain in what you shared.",
        });
      }
    }

    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent, addDomain]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={screenOptions}>
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
      <RootErrorBoundary>
        <ShareIntentProvider options={{ resetOnBackground: true, debug: false }}>
          <AnalyticsProvider>
            <ApiProvider>
              <VersionGate>
                <I18nProvider i18n={i18n}>
                  <RootNavigator />
                </I18nProvider>
              </VersionGate>
            </ApiProvider>
          </AnalyticsProvider>
        </ShareIntentProvider>
      </RootErrorBoundary>
    </GestureHandlerRootView>
  );
}
