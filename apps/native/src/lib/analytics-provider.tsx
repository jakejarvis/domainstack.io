import { PostHogProvider } from "posthog-react-native";
import { useEffect, useRef } from "react";

import { analytics, posthog } from "./analytics";
import { authClient } from "./auth";
import { usePrivacyStore } from "./stores/privacy-store";

function PrivacySync() {
  const analyticsEnabled = usePrivacyStore((state) => state.analyticsEnabled);
  const hasHydrated = usePrivacyStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!posthog || !hasHydrated) return;
    if (analyticsEnabled) {
      void posthog.optIn();
    } else {
      void posthog.optOut();
    }
  }, [analyticsEnabled, hasHydrated]);

  return null;
}

function PostHogIdentitySync() {
  const session = authClient.useSession();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const user = session.data?.user;
    const currentUserId = user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    if (currentUserId && currentUserId !== previousUserId) {
      if (!analytics.isIdentified()) {
        analytics.identify(
          currentUserId,
          { email: user?.email, name: user?.name },
          {
            createdAt: user?.createdAt ? new Date(user.createdAt).toISOString() : undefined,
          },
        );
      }
    }

    if (!currentUserId && previousUserId) {
      analytics.reset();
    }

    previousUserIdRef.current = currentUserId;
  }, [session.data]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!posthog) return <>{children}</>;

  return (
    <PostHogProvider client={posthog}>
      <PrivacySync />
      <PostHogIdentitySync />
      {children}
    </PostHogProvider>
  );
}
