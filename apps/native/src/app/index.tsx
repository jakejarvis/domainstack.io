import { Redirect } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/screen";
import { Spinner } from "@/components/spinner";
import { authClient } from "@/lib/auth";
import { getInitialRoute } from "@/lib/navigation";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

export { ScreenErrorBoundary as ErrorBoundary } from "@/components/screen-error-boundary";

export default function IndexRoute() {
  const session = authClient.useSession();
  const onboardingSeen = useOnboardingStore((state) => state.seen);
  const onboardingHydrated = useOnboardingStore((state) => state.hasHydrated);

  if (session.isPending || !onboardingHydrated) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner variant="muted" />
        </View>
      </Screen>
    );
  }

  const isAuthenticated = Boolean(session.data?.user);
  if (!isAuthenticated && !onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href={getInitialRoute(isAuthenticated)} />;
}
