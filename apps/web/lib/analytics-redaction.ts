import type { CaptureResult } from "posthog-js";

// The calendar feed URL carries a bearer token (`.../feed.ics?token=…`, raw or URL-encoded).
const FEED_TOKEN_PATTERN =
  /feed\.ics(?:\?|%3F)token(?:=|%3D)|calendar\/user(?:\?|%3F)token(?:=|%3D)/i;

/** PostHog `before_send` guard: drops any event whose properties contain a calendar feed token. */
export function dropEventsWithFeedTokens(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  return FEED_TOKEN_PATTERN.test(JSON.stringify(event.properties ?? {})) ? null : event;
}
