import { PostHogProvider } from "posthog-react-native";

import { posthogHost, posthogKey } from "./env";

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
      {children}
    </PostHogProvider>
  );
}
