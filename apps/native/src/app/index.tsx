import { Redirect } from "expo-router";

import { Screen } from "@/components/screen";
import { MutedText } from "@/components/text";
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
        <MutedText>Loading Domainstack…</MutedText>
      </Screen>
    );
  }

  const isAuthenticated = Boolean(session.data?.user);
  if (!isAuthenticated && !onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href={getInitialRoute(isAuthenticated)} />;
}
