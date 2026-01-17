import "server-only";

import { cookies } from "next/headers";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import { cache } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  IdentifyProperties,
  IdentifySetOnceProperties,
} from "@/lib/analytics/types";

// PostHog clients maintain background flushers; keep a single shared instance
// per runtime to avoid reopening sockets for every event. We deliberately avoid
// calling client.shutdown() after each capture so the client stays usable.
let sharedClient: PostHog | null = null;

function getServerPosthog(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }

  if (!sharedClient) {
    sharedClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return sharedClient;
}

const getDistinctId = cache(async (): Promise<string> => {
  let distinctId: string | undefined;

  try {
    const cookieStore = await cookies();
    const phCookie = cookieStore.get(
      `ph_${process.env.NEXT_PUBLIC_POSTHOG_KEY}_posthog`,
    );
    if (phCookie?.value) {
      try {
        const parsed = JSON.parse(decodeURIComponent(phCookie.value));
        if (parsed && typeof parsed.distinct_id === "string") {
          distinctId = parsed.distinct_id;
        }
      } catch {}
    }
  } catch (err) {
    // cookies() throws when called outside request scope (e.g., during prerender)
    // Log unexpected errors that don't match the known pattern
    const isExpectedError =
      err instanceof Error && err.message.includes("outside a request scope");
    if (!isExpectedError) {
      // Use console.warn to avoid circular dependency with logger
      console.warn("unexpected error accessing cookies", err);
    }
    // Fall through to generate a UUID
  }

  // fallback to distinct uuid
  if (!distinctId) {
    distinctId = uuidv4();
  }

  return distinctId;
});

/**
 * Analytics tracking utility for server-side contexts.
 * Use this in server components, API routes, and server actions.
 *
 * Note: These functions are fire-and-forget. They return immediately
 * and perform tracking in the background via after() (when available).
 *
 * Implementation: To comply with Next.js restrictions on using cookies()
 * inside after(), we call getDistinctId() outside to start the promise.
 * Since getDistinctId() is wrapped in cache(), this triggers cookies()
 * during the request phase, and we just await the cached result inside after().
 */
export const analytics = {
  /**
   * Identify a user with PostHog server-side.
   * Use this to ensure user properties are set even when client-side identify
   * might not have run yet (e.g., in API routes, server actions).
   *
   * @param userId - The user's unique ID (from better-auth)
   * @param properties - Properties to set/update on the user ($set)
   * @param setOnceProperties - Properties to set only once ($set_once)
   */
  identify: (
    userId: string,
    properties?: IdentifyProperties,
    setOnceProperties?: IdentifySetOnceProperties,
  ) => {
    const doIdentify = async () => {
      const client = getServerPosthog();
      if (!client) {
        return;
      }

      await client.identifyImmediate({
        distinctId: userId,
        properties: {
          $set: properties,
          $set_once: setOnceProperties,
        },
      });
    };

    after(() => doIdentify());
  },

  track: (
    event: string,
    properties: Record<string, unknown>,
    distinctId?: string,
  ) => {
    // Start getDistinctId() promise outside of after() to trigger cookies()
    // during the request phase (not inside the after callback)
    const distinctIdPromise = distinctId
      ? Promise.resolve(distinctId)
      : getDistinctId();

    const doTrack = async () => {
      const client = getServerPosthog();
      if (!client) {
        return;
      }

      // Await the promise that was started outside of after()
      const resolvedDistinctId = (await distinctIdPromise) || "server";

      await client.captureImmediate({
        event,
        distinctId: resolvedDistinctId,
        properties,
      });
    };

    after(() => doTrack());
  },

  /**
   * @internal Use logger.error() instead, which automatically tracks exceptions.
   */
  trackException: (
    error: Error,
    properties: Record<string, unknown>,
    distinctId?: string,
  ) => {
    // Start getDistinctId() promise outside of after() to trigger cookies()
    // during the request phase (not inside the after callback)
    const distinctIdPromise = distinctId
      ? Promise.resolve(distinctId)
      : getDistinctId();

    const doTrack = async () => {
      const client = getServerPosthog();
      if (!client) {
        return;
      }

      // Await the promise that was started outside of after()
      const resolvedDistinctId = (await distinctIdPromise) || "server";

      client.captureException(error, resolvedDistinctId, properties);
    };

    after(() => doTrack());
  },
};
