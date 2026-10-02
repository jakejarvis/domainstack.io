import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";

import { dropEventsWithFeedTokens } from "./analytics-redaction";

function makeEvent(event: string, properties: Record<string, unknown>): CaptureResult {
  return { uuid: "test-uuid", event, properties };
}

describe("dropEventsWithFeedTokens", () => {
  it("drops autocapture events whose element chain contains a feed token", () => {
    const event = makeEvent("$autocapture", {
      $elements_chain: 'button:text="https://domainstack.io/dashboard/feed.ics?token=ck_abc"',
    });
    expect(dropEventsWithFeedTokens(event)).toBeNull();
  });

  it("drops events whose external click url carries the URL-encoded feed", () => {
    const webcal = "webcal://domainstack.io/dashboard/feed.ics?token=ck_abc";
    const event = makeEvent("$autocapture", {
      $external_click_url: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    });
    expect(dropEventsWithFeedTokens(event)).toBeNull();
  });

  it("returns ordinary events unchanged", () => {
    const event = makeEvent("$pageview", {
      $current_url: "https://domainstack.io/settings/notifications",
    });
    expect(dropEventsWithFeedTokens(event)).toBe(event);
  });

  it("returns null for null input", () => {
    expect(dropEventsWithFeedTokens(null)).toBeNull();
  });
});
