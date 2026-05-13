import { Redirect } from "expo-router";

import { Screen } from "@/components/screen";
import { MutedText } from "@/components/text";
import { authClient } from "@/lib/auth";
import { getInitialRoute } from "@/lib/navigation";

export default function IndexRoute() {
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <Screen>
        <MutedText>Loading Domainstack…</MutedText>
      </Screen>
    );
  }

  return <Redirect href={getInitialRoute(Boolean(session.data?.user))} />;
}
