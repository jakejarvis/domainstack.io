import "server-only";

import crypto from "node:crypto";
import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";
import { BASE_URL } from "@/lib/constants/app";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";

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
 * All domain expirations are emitted as all-day events because:
 * - Users care about the date, not specific time
 * - RDAP/WHOIS times are often registry-local timezone
 * - All-day events are more visible in calendar apps
 */
export function generateCalendarFeed(
  domains: TrackedDomainWithDetails[],
): CalendarFeedResult {
  // Filter to verified domains with expiration dates
  const expiringDomains = domains.filter(
    (d) => d.verified && d.expirationDate !== null,
  );

  const now = new Date();
  const events: IcsEvent[] = expiringDomains
    .filter((domain) => domain.expirationDate !== null)
    .map((domain) => ({
      // Stable UID: uses trackedDomainId which is unique per user+domain
      uid: `${domain.id}@domainstack.io`,
      // Required: timestamp when this event was created/modified
      stamp: { date: now },
      // For all-day events, use DATE type (not DATE-TIME)
      start: { date: domain.expirationDate as Date, type: "DATE" as const },
      // All-day events need a duration of 1 day
      duration: { days: 1 },
      summary: `🌐 ${domain.domainName} expires`,
      description: buildEventDescription(domain),
      url: `${BASE_URL}/dashboard?domainId=${domain.id}`,
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
  const etag = computeEtag(expiringDomains);

  return {
    icsContent,
    etag,
    eventCount: expiringDomains.length,
  };
}

/**
 * Build the event description with domain details.
 */
function buildEventDescription(domain: TrackedDomainWithDetails): string {
  const lines: string[] = [`Domain: ${domain.domainName}`];

  if (domain.registrar.name) {
    lines.push(`Registrar: ${domain.registrar.name}`);
  }

  if (domain.expirationDate) {
    lines.push("");
    lines.push(`Exact time: ${domain.expirationDate.toISOString()}`);
  }

  if (domain.ca.certificateExpiryDate) {
    lines.push(
      `SSL certificate expires: ${domain.ca.certificateExpiryDate.toISOString()}`,
    );
  }

  lines.push("");
  lines.push(`View more details: ${BASE_URL}/dashboard?domainId=${domain.id}`);

  return lines.join("\n");
}

/**
 * Compute a stable ETag for the calendar based on domain data.
 * Used for HTTP conditional requests (304 Not Modified).
 */
function computeEtag(domains: TrackedDomainWithDetails[]): string {
  if (domains.length === 0) {
    return "empty";
  }

  // Create a hash of all domain IDs and their expiration dates
  // Sorted for deterministic output
  const hashInput = domains
    .map((d) => `${d.id}:${d.expirationDate?.toISOString() ?? ""}`)
    .sort()
    .join("|");

  return crypto
    .createHash("sha256")
    .update(hashInput)
    .digest("hex")
    .slice(0, 16);
}
