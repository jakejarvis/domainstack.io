"use client";

import posthog from "posthog-js";
import { useMemo } from "react";

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
 * Analytics tracking utility for non-React contexts.
 * Use this in hooks or other non-component code.
 */
export const analytics = {
  track,
  trackException,
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
 * ```
 */
export function useAnalytics() {
  return useMemo(
    () => ({
      track,
      trackException,
    }),
    [],
  );
}
