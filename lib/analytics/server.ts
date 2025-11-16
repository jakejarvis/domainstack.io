import "server-only";

import { cookies } from "next/headers";
import { after } from "next/server";
import { PostHog } from "posthog-node";
import { cache } from "react";
import { v4 as uuidv4 } from "uuid";

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

    // Run in background when available, otherwise fire-and-forget
    try {
      after(() => doTrack());
    } catch {
      // If after not available, still track but don't block
      doTrack().catch(() => {
        // no-op - graceful degradation
      });
    }
  },

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

    // Run in background when available, otherwise fire-and-forget
    try {
      after(() => doTrack());
    } catch {
      // If after not available, still track but don't block
      doTrack().catch(() => {
        // no-op - graceful degradation
      });
    }
  },
};
