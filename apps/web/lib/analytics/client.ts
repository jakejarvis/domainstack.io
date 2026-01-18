"use client";

import posthog from "posthog-js";
import { useMemo } from "react";
import type {
  IdentifyProperties,
  IdentifySetOnceProperties,
} from "@/lib/analytics/types";

/**
 * Track identification state locally to avoid relying on PostHog's private API.
 * This is set when identify() is called and cleared when reset() is called.
 */
let identifiedUserId: string | null = null;

function track(event: string, properties?: Record<string, unknown>) {
  try {
    posthog.capture(event, properties);
  } catch {
    // no-op
  }
}

function trackException(error: Error, properties?: Record<string, unknown>) {
  try {
    posthog.captureException(error, properties);
  } catch {
    // no-op
  }
}

/**
 * Identify a user with PostHog.
 * Should be called when a user logs in or on session hydration.
 *
 * @param userId - The user's unique ID (from better-auth)
 * @param properties - Properties to set/update on the user ($set)
 * @param setOnceProperties - Properties to set only once ($set_once)
 */
function identify(
  userId: string,
  properties?: IdentifyProperties,
  setOnceProperties?: IdentifySetOnceProperties,
) {
  try {
    posthog.identify(userId, properties, setOnceProperties);
    identifiedUserId = userId;
  } catch {
    // no-op
  }
}

/**
 * Reset the current user's identity.
 * Should be called when a user logs out to prevent event crossover.
 */
function reset() {
  try {
    posthog.reset();
    identifiedUserId = null;
  } catch {
    // no-op
  }
}

/**
 * Check if the current user has been identified.
 * Use this to prevent duplicate identify calls.
 */
function isIdentified(): boolean {
  return identifiedUserId !== null;
}

/**
 * Get the current user's distinct ID.
 */
function getDistinctId(): string | undefined {
  try {
    return posthog.get_distinct_id();
  } catch {
    return;
  }
}

/**
 * Analytics tracking utility for non-React contexts.
 * Use this in hooks or other non-component code.
 */
export const analytics = {
  track,
  trackException,
  identify,
  reset,
  isIdentified,
  getDistinctId,
};

/**
 * Analytics tracking hook for React components.
 * Use this in components for tracking user interactions.
 *
 * @example
 * ```tsx
 * const analytics = useAnalytics();
 * analytics.track("button_clicked", { button: "export" });
 * analytics.trackException(error, { context: "export" });
 * analytics.identify(userId, { email, name });
 * analytics.reset(); // on logout
 * ```
 */
export function useAnalytics() {
  return useMemo(
    () => ({
      track,
      trackException,
      identify,
      reset,
      isIdentified,
      getDistinctId,
    }),
    [],
  );
}
