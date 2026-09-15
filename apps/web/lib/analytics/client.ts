"use client";

import posthogClient from "posthog-js";
import { useMemo } from "react";

import type {
  AnalyticsProperties,
  IdentifyProperties,
  IdentifySetOnceProperties,
} from "@domainstack/types";

function track(event: string, properties?: AnalyticsProperties) {
  try {
    posthogClient.capture(event, properties);
  } catch {
    // no-op
  }
}

function trackException(error: unknown, properties?: AnalyticsProperties) {
  try {
    posthogClient.captureException(error, properties);
  } catch {
    // no-op
  }
}

function identify(
  userId: string,
  properties?: IdentifyProperties,
  setOnceProperties?: IdentifySetOnceProperties,
) {
  try {
    posthogClient.identify(userId, properties, setOnceProperties);
  } catch {
    // no-op
  }
}

function reset() {
  try {
    posthogClient.reset();
  } catch {
    // no-op
  }
}

function setPersonProperties(properties: IdentifyProperties) {
  try {
    posthogClient.setPersonProperties(properties);
  } catch {
    // no-op
  }
}

export const analytics = {
  track,
  trackException,
  identify,
  reset,
  setPersonProperties,
};

export function useAnalytics() {
  return useMemo(
    () => ({
      track,
      trackException,
      identify,
      reset,
      setPersonProperties,
    }),
    [],
  );
}
