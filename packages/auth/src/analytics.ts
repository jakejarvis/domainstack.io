import { waitUntil } from "@vercel/functions";

/**
 * Fire-and-forget PostHog capture for auth lifecycle hooks.
 * Never throws — account creation must not fail because analytics is down.
 */
export const analytics = {
  track: (event: string, properties: Record<string, unknown>, userId: string): void => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) {
      return;
    }

    waitUntil(
      fetch(`${process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"}/i/v0/e/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          event,
          distinct_id: userId,
          properties,
        }),
      }).catch((err) => {
        console.error("failed to track event", err);
      }),
    );
  },
};
