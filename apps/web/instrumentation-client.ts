import posthogClient from "posthog-js";

posthogClient.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
  api_host: "/_proxy/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-05-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  // GDPR: don't set cookies until the user consents; cookieless until then
  cookieless_mode: "on_reject",
});
