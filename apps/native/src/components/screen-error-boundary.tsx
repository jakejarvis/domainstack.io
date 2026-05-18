import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";

import { analytics } from "@/lib/analytics";

import { QueryErrorState } from "./query-error-state";
import { Screen } from "./screen";

// Re-exported so route files declare a single `ErrorBoundary` dependency
// (`@/components/screen-error-boundary`) instead of also reaching into
// `expo-router` for the prop type.
export type { ErrorBoundaryProps } from "expo-router";

/**
 * Per-route fallback. expo-router catches a render throw in the route and
 * renders this *inside* the navigator, so the native header + tab bar stay put
 * and the user gets an inline, offline-aware retry instead of the whole app
 * dropping to the catastrophic root crash screen.
 *
 * Intentionally lean: no in-body header / account chrome (it's inappropriate
 * on detail/auth/settings screens and a needless second crash surface in an
 * already-failed render). expo-router doesn't report the error itself, so do
 * it here — once per distinct error.
 */
export function ScreenErrorBoundary({
  error,
  retry,
  title = "Something went wrong",
}: ErrorBoundaryProps & { title?: string }) {
  useEffect(() => {
    analytics.trackException(error, { boundary: "screen", screen: title });
  }, [error, title]);

  return (
    <Screen>
      <QueryErrorState onRetry={() => void retry()} title={title} />
    </Screen>
  );
}
