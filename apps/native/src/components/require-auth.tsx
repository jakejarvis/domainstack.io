import { router } from "expo-router";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { Screen } from "@/components/screen";
import { authClient } from "@/lib/auth";

/**
 * Auth gate shared by every signed-in-only tab screen. Replaces four
 * copy-pasted `session.isPending`/`!user` blocks that had drifted into
 * inconsistent skeletons and locked-state copy ("Portfolio is locked" vs
 * "Sign in required" vs "Account required").
 *
 * `header`/`loading` let each screen keep its own chrome and skeleton; the
 * locked state is uniform: lock icon, "<Feature> is locked" title, "Sign in".
 */
export function RequireAuth({
  body,
  children,
  header,
  loading,
  title,
}: {
  body: string;
  children: ReactNode;
  header?: ReactNode;
  loading: ReactNode;
  title: string;
}) {
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <Screen>
        {header}
        {loading}
      </Screen>
    );
  }

  if (!session.data?.user) {
    return (
      <Screen>
        {header}
        <EmptyState
          actionLabel="Sign in"
          body={body}
          icon={{ android: "lock", ios: "lock" }}
          onAction={() => router.push("/sign-in")}
          title={title}
        />
      </Screen>
    );
  }

  return <>{children}</>;
}
