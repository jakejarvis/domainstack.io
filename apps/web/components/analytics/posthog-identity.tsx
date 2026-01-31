"use client";

import { analytics } from "@domainstack/analytics/client";
import { useSession } from "@domainstack/auth/client";
import { useEffect, useRef } from "react";

/**
 * PostHog identity provider that automatically identifies users on login
 * and resets identity on logout.
 *
 * This component should be placed inside the app providers to watch for
 * session changes and keep PostHog identity in sync with auth state.
 */
export function PostHogIdentityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = session?.user?.id ?? null;
    const previousUserId = previousUserIdRef.current;

    // User logged in or session hydrated with user
    if (currentUserId && currentUserId !== previousUserId) {
      // Only identify if not already identified with this user
      if (!analytics.isIdentified()) {
        const user = session?.user;
        if (user) {
          analytics.identify(
            user.id,
            // $set properties (can change)
            {
              email: user.email,
              name: user.name,
            },
            // $set_once properties (immutable)
            {
              createdAt: user.createdAt
                ? new Date(user.createdAt).toISOString()
                : undefined,
            },
          );
        }
      }
    }

    // User logged out
    if (!currentUserId && previousUserId) {
      analytics.reset();
    }

    // Update ref for next comparison
    previousUserIdRef.current = currentUserId;
  }, [session]);

  return <>{children}</>;
}
