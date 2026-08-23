"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { analytics } from "@/lib/analytics/client";
import { useTRPC } from "@/lib/trpc/client";
import { useSession } from "@domainstack/auth/client";

/**
 * PostHog identity provider that automatically identifies users on login
 * and resets identity on logout.
 *
 * This component should be placed inside the app providers to watch for
 * session changes and keep PostHog identity in sync with auth state.
 */
export function PostHogIdentityProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const previousUserIdRef = useRef<string | null>(null);
  const dropStaleTierRef = useRef(false);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const userId = session?.user?.id;
  const subscriptionQueryKey = trpc.user.getSubscription.queryKey();

  const { data: subscription } = useQuery({
    ...trpc.user.getSubscription.queryOptions(),
    enabled: !!userId,
  });

  useEffect(() => {
    const currentUserId = userId ?? null;
    const previousUserId = previousUserIdRef.current;

    // User logged in, session hydrated, or account switched
    if (currentUserId && currentUserId !== previousUserId) {
      if (previousUserId) {
        dropStaleTierRef.current = true;
        queryClient.removeQueries({ queryKey: subscriptionQueryKey });
      }
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
            createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
          },
        );
      }
    }

    // User logged out
    if (!currentUserId && previousUserId) {
      analytics.reset();
      queryClient.removeQueries({ queryKey: subscriptionQueryKey });
    }

    previousUserIdRef.current = currentUserId;
  }, [session?.user, userId, queryClient, subscriptionQueryKey]);

  useEffect(() => {
    if (dropStaleTierRef.current) {
      dropStaleTierRef.current = false;
      return;
    }
    if (!userId || !subscription?.plan) {
      return;
    }
    analytics.setPersonProperties({ tier: subscription.plan });
  }, [userId, subscription?.plan]);

  return <>{children}</>;
}
