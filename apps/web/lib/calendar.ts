import "server-only";
import crypto from "node:crypto";

import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";

import type { TrackedDomainWithDetails } from "@domainstack/types";
import { buildDomainExpiryEvents, type DomainExpiryEvent } from "@domainstack/utils/calendar";

/**
 * Result of generating a calendar feed.
 */
export interface CalendarFeedResult {
  /** The ICS content as a string */
  icsContent: string;
  /** ETag for caching (based on domain data) */
  etag: string;
  /** Number of events in the calendar */
  eventCount: number;
}

/**
 * Generate an iCalendar feed for domain expirations.
 *
 * Event shaping (filtering, summary, description, deep link) is delegated to
 * `buildDomainExpiryEvents`. This module keeps the web-only concerns: ICS
 * serialization (`ts-ics`) and the HTTP ETag.
 *
 * All domain expirations are emitted as all-day events because:
 * - Users care about the date, not specific time
 * - RDAP/WHOIS times are often registry-local timezone
 * - All-day events are more visible in calendar apps
 */
export function generateCalendarFeed(domains: TrackedDomainWithDetails[]): CalendarFeedResult {
  const now = new Date();
  const expiryEvents = buildDomainExpiryEvents(domains, {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "",
  });

  const events: IcsEvent[] = expiryEvents.map((event) => ({
    uid: event.uid,
    stamp: { date: now },
    start: { date: event.expirationDate, type: "DATE" as const },
    duration: { days: 1 },
    summary: event.summary,
    description: event.description,
    url: event.url,
    categories: ["Domain Expiration"],
  }));

  const calendar: IcsCalendar = {
    version: "2.0",
    prodId: "-//Domainstack//Calendar Feed//EN",
    method: "PUBLISH",
    name: "Domain Expirations by Domainstack",
    events,
  };

  const icsContent = generateIcsCalendar(calendar);
  const etag = computeEtag(expiryEvents);

  return {
    icsContent,
    etag,
    eventCount: expiryEvents.length,
  };
}

/**
 * Hash of everything that appears in the feed except DTSTAMP, so a changed
 * description (registrar, SSL expiry) invalidates clients' cached copies.
 * Used for HTTP conditional requests (304 Not Modified).
 */
function computeEtag(events: DomainExpiryEvent[]): string {
  if (events.length === 0) {
    return "empty";
  }

  // Events arrive sorted by uid from buildDomainExpiryEvents.
  const hashInput = events
    .map((e) =>
      JSON.stringify([e.uid, e.expirationDate.toISOString(), e.summary, e.description, e.url]),
    )
    .join("\n");

  return crypto.createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}
