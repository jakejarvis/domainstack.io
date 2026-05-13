import { PostHogProvider, usePostHog } from "posthog-react-native";
import { useEffect } from "react";

import { posthogHost, posthogKey } from "./env";
import { usePrivacyStore } from "./stores/privacy-store";

function PrivacySync() {
  const posthog = usePostHog();
  const analyticsEnabled = usePrivacyStore((state) => state.analyticsEnabled);
  const hasHydrated = usePrivacyStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!posthog || !hasHydrated) return;
    if (analyticsEnabled) {
      posthog.optIn();
    } else {
      posthog.optOut();
    }
  }, [analyticsEnabled, hasHydrated, posthog]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!posthogKey) return <>{children}</>;

  return (
    <PostHogProvider
      apiKey={posthogKey}
      options={{
        captureAppLifecycleEvents: true,
        enableSessionReplay: false,
        host: posthogHost,
      }}
    >
      <PrivacySync />
      {children}
    </PostHogProvider>
  );
}
