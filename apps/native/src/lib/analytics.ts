import type { PostHogEventProperties } from "@posthog/core";
import { PostHog } from "posthog-react-native";

import { posthogHost, posthogKey } from "./env";
import { usePrivacyStore } from "./stores/privacy-store";

interface IdentifyProperties {
  email?: string;
  name?: string;
  tier?: string;
}

interface IdentifySetOnceProperties {
  createdAt?: string;
}

export const posthog: PostHog | null = posthogKey
  ? new PostHog(posthogKey, {
      captureAppLifecycleEvents: true,
      // Start opted-out. `PrivacySync` (analytics-provider.tsx) calls `optIn()`
      // only after the privacy store rehydrates from AsyncStorage and confirms
      // consent, so a previously opted-out user has nothing captured (including
      // lifecycle events) during the cold-start hydration window.
      defaultOptIn: false,
      enableSessionReplay: false,
      errorTracking: { autocapture: false },
      host: posthogHost,
    })
  : null;

let identifiedUserId: string | null = null;

// Defense-in-depth alongside `defaultOptIn: false`: drop every capture until the
// privacy store has rehydrated and consent state is known. This makes the
// pre-consent contract explicit at each call site rather than relying solely on
// PostHog's internal opt-out state.
function consentReady(): boolean {
  return usePrivacyStore.getState().hasHydrated;
}

function withPlatform(properties?: Record<string, unknown>): PostHogEventProperties {
  return { ...properties, platform: "native" } as PostHogEventProperties;
}

function track(event: string, properties?: Record<string, unknown>) {
  if (!posthog || !consentReady()) return;
  try {
    posthog.capture(event, withPlatform(properties));
  } catch {
    // no-op
  }
}

function trackException(error: Error | unknown, properties?: Record<string, unknown>) {
  if (!posthog || !consentReady()) return;
  if (!usePrivacyStore.getState().errorCaptureEnabled) return;
  try {
    posthog.captureException(error, withPlatform(properties));
  } catch {
    // no-op
  }
}

function identify(
  userId: string,
  properties?: IdentifyProperties,
  setOnceProperties?: IdentifySetOnceProperties,
) {
  if (!posthog || !consentReady()) return;
  try {
    posthog.identify(userId, {
      $set: properties,
      $set_once: setOnceProperties,
    } as unknown as PostHogEventProperties);
    identifiedUserId = userId;
  } catch {
    // no-op
  }
}

function reset() {
  if (!posthog) return;
  try {
    posthog.reset();
    identifiedUserId = null;
  } catch {
    // no-op
  }
}

function isIdentified(): boolean {
  return identifiedUserId !== null;
}

function getDistinctId(): string | undefined {
  if (!posthog) return;
  try {
    return posthog.getDistinctId();
  } catch {
    return;
  }
}

export const analytics = {
  track,
  trackException,
  identify,
  reset,
  isIdentified,
  getDistinctId,
};
