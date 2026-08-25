import posthogClient from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (!posthogKey) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. Configure NEXT_PUBLIC_POSTHOG_KEY to enable analytics.",
    );
  }
} else {
  posthogClient.init(posthogKey, {
    api_host: "/_proxy/ingest",
    tracing_headers: [window.location.hostname],
    defaults: "2026-05-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    // GDPR: don't set cookies until the user consents; cookieless until then
    cookieless_mode: "on_reject",
  });
}
