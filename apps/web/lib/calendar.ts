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
 * the isomorphic `buildDomainExpiryEvents` builder so this webcal feed and the
 * native device-local calendar emit identical content. This module keeps only
 * the web-only concerns: ICS serialization (`ts-ics`) and the HTTP ETag.
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
    // Stable UID: uses trackedDomainId which is unique per user+domain
    uid: event.uid,
    // Required: timestamp when this event was created/modified
    stamp: { date: now },
    // For all-day events, use DATE type (not DATE-TIME)
    start: { date: event.expirationDate, type: "DATE" as const },
    // All-day events need a duration of 1 day
    duration: { days: 1 },
    summary: event.summary,
    description: event.description,
    url: event.url,
    categories: ["Domain Expiration"],
  }));

  const calendar: IcsCalendar = {
    version: "2.0",
    prodId: "-//Domainstack//Calendar Feed//EN",
    // PUBLISH method is standard for subscription feeds
    // (as opposed to REQUEST for meeting invitations)
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
 * Compute a stable ETag for the calendar based on domain data.
 * Used for HTTP conditional requests (304 Not Modified).
 */
function computeEtag(events: DomainExpiryEvent[]): string {
  if (events.length === 0) {
    return "empty";
  }

  // Create a hash of all domain IDs and their expiration dates
  // Sorted for deterministic output
  const hashInput = events
    .map((e) => `${e.trackedDomainId}:${e.expirationDate.toISOString()}`)
    .sort()
    .join("|");

  return crypto.createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}
