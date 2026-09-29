import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeProvider, makeTrackedDomain } from "@/components/dashboard/test-fixtures";

import { generateCalendarFeed } from "./calendar";

describe("generateCalendarFeed etag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is stable across calls even though DTSTAMP changes", () => {
    const domains = [makeTrackedDomain({ id: "domain-a", domainName: "a.com" })];

    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const first = generateCalendarFeed(domains);
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    const second = generateCalendarFeed(domains);

    // The body differs (per-request DTSTAMP) but the etag must not.
    expect(first.icsContent).not.toBe(second.icsContent);
    expect(first.etag).toBe(second.etag);
  });

  it("changes when the SSL certificate expiry date changes", () => {
    const withCert = (date: Date) =>
      makeTrackedDomain({
        id: "domain-a",
        domainName: "a.com",
        ca: { ...makeProvider("letsencrypt", "Let's Encrypt"), certificateExpiryDate: date },
      });

    const before = generateCalendarFeed([withCert(new Date("2026-09-01T00:00:00.000Z"))]);
    const after = generateCalendarFeed([withCert(new Date("2026-11-01T00:00:00.000Z"))]);

    expect(before.etag).not.toBe(after.etag);
  });

  it("changes when the registrar name changes", () => {
    const withRegistrar = (name: string) =>
      makeTrackedDomain({
        id: "domain-a",
        domainName: "a.com",
        registrar: makeProvider("registrar", name),
      });

    const before = generateCalendarFeed([withRegistrar("Namecheap")]);
    const after = generateCalendarFeed([withRegistrar("Cloudflare")]);

    expect(before.etag).not.toBe(after.etag);
  });

  it('returns "empty" when there are no verified domains with an expiration', () => {
    const { etag, eventCount } = generateCalendarFeed([
      makeTrackedDomain({ id: "domain-a", domainName: "a.com", verified: false }),
    ]);

    expect(eventCount).toBe(0);
    expect(etag).toBe("empty");
  });
});
