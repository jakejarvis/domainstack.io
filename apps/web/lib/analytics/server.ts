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

function stringifyThrownObject(error: object): string {
  try {
    const serialized = JSON.stringify(error);
    if (typeof serialized === "string") {
      return serialized;
    }
  } catch {
    // circular structures, BigInt, etc.
  }
  return Object.prototype.toString.call(error);
}

function exceptionFingerprint(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "object" && error !== null) {
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : stringifyThrownObject(error);
    return `Error: ${message}`;
  }

  return `Error: ${String(error)}`;
}

export async function captureException(
  error: unknown,
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
  // splits one burst across several issues. Non-Errors are coerced only to build
  // the fingerprint; posthog-node extracts its own details from the raw value.
  client.captureException(error, distinctId, {
    ...properties,
    $exception_fingerprint: exceptionFingerprint(error),
  });

  // Deferring past the response is the caller's job — `trackException` already
  // wraps this in `after()`, and `onRequestError` runs off the response path.
  await client.flush();
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

  trackException: (error: unknown, properties?: Record<string, unknown>, userId?: string) => {
    after(() => captureException(error, userId, properties));
  },
};
