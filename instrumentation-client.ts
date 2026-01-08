import posthog from "posthog-js";

// PostHog
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
  api_host: "/_proxy/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2025-05-24",
  capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
  debug: process.env.NODE_ENV === "development",
  // GDPR: Don't set cookies until user consents - switches to cookieless tracking mode on reject
  cookieless_mode: "on_reject",
});
