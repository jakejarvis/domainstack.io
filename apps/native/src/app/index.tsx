import { Redirect } from "expo-router";

import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { authClient } from "@/lib/auth";
import { getInitialRoute } from "@/lib/navigation";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

export default function IndexRoute() {
  const session = authClient.useSession();
  const onboardingSeen = useOnboardingStore((state) => state.seen);
  const onboardingHydrated = useOnboardingStore((state) => state.hasHydrated);

  if (session.isPending || !onboardingHydrated) {
    return (
      <Screen>
        <Text className="text-sm text-muted-foreground">Loading…</Text>
      </Screen>
    );
  }

  const isAuthenticated = Boolean(session.data?.user);
  if (!isAuthenticated && !onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href={getInitialRoute(isAuthenticated)} />;
}
