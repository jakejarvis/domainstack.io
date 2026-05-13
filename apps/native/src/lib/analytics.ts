import type { PostHogEventProperties } from "@posthog/core";
import { PostHog } from "posthog-react-native";
import { useMemo } from "react";

import { posthogHost, posthogKey } from "./env";
import { usePrivacyStore } from "./stores/privacy-store";

export interface IdentifyProperties {
  email?: string;
  name?: string;
  tier?: string;
}

export interface IdentifySetOnceProperties {
  createdAt?: string;
}

export const posthog: PostHog | null = posthogKey
  ? new PostHog(posthogKey, {
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
      errorTracking: { autocapture: false },
      host: posthogHost,
    })
  : null;

let identifiedUserId: string | null = null;

function withPlatform(properties?: Record<string, unknown>): PostHogEventProperties {
  return { ...properties, platform: "native" } as PostHogEventProperties;
}

function track(event: string, properties?: Record<string, unknown>) {
  if (!posthog) return;
  try {
    posthog.capture(event, withPlatform(properties));
  } catch {
    // no-op
  }
}

function trackException(error: Error | unknown, properties?: Record<string, unknown>) {
  if (!posthog) return;
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
  if (!posthog) return;
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
