import "server-only";
import { after } from "next/server";
import { PostHog } from "posthog-node";

import type { IdentifyProperties, IdentifySetOnceProperties } from "./types";

const client = process.env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    })
  : null;

export async function captureException(
  error: Error,
  userId?: string,
  properties?: Record<string, unknown>,
) {
  if (!client) {
    return;
  }

  // posthog-node invents a new anonymous person for every capture that has no
  // distinct id, which inflates the user count on each server-side issue. Fall
  // back to a shared anonymous id so one burst counts as one user.
  const distinctId = userId ?? "anonymous";

  // Group by the error type and message, not the stack. Node adds or drops async
  // tick frames between otherwise identical throws, so a stack-based fingerprint
  // splits one burst across several issues.
  client.captureException(error, distinctId, {
    ...properties,
    $exception_fingerprint: `${error.name}: ${error.message}`,
  });
  after(() => client.flush());
}

export const analytics = {
  identify: (
    userId: string,
    properties?: IdentifyProperties,
    setOnceProperties?: IdentifySetOnceProperties,
  ) => {
    if (!client) {
      return;
    }

    const posthog = client;
    after(() =>
      posthog.identifyImmediate({
        distinctId: userId,
        properties: {
          $set: properties,
          $set_once: setOnceProperties,
        },
      }),
    );
  },

  track: (event: string, properties: Record<string, unknown>, userId: string) => {
    if (!client) {
      return;
    }

    const posthog = client;
    after(() =>
      posthog.captureImmediate({
        event,
        distinctId: userId,
        properties,
      }),
    );
  },

  trackException: (error: Error, properties?: Record<string, unknown>, userId?: string) => {
    after(() => captureException(error, userId, properties));
  },
};
