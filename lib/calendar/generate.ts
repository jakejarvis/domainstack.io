import "server-only";

import crypto from "node:crypto";
import ical from "ical-generator";
import { BASE_URL } from "@/lib/constants";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";

/**
 * Result of generating a calendar feed.
 */
export type CalendarFeedResult = {
  /** The ICS content as a string */
  icsContent: string;
  /** ETag for caching (based on domain data) */
  etag: string;
  /** Number of events in the calendar */
  eventCount: number;
};

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

  const calendar = ical({
    name: "Domainstack Domain Expirations",
    description:
      "Expiration dates for your tracked domains. Powered by Domainstack.",
    prodId: {
      company: "Domainstack",
      product: "Calendar Feed",
      language: "EN",
    },
    // PUBLISH method is standard for subscription feeds
    // (as opposed to REQUEST for meeting invitations)
    // Note: ical-generator handles this automatically when not specified
  });

  for (const domain of expiringDomains) {
    // Skip if no expiration date (shouldn't happen after filtering)
    if (!domain.expirationDate) continue;

    calendar.createEvent({
      // Stable UID: uses trackedDomainId which is unique per user+domain
      id: `${domain.id}@domainstack.io`,
      // For all-day events, we just pass the date
      start: domain.expirationDate,
      allDay: true,
      // Emoji helps visibility in calendar views
      summary: `🌐 ${domain.domainName} expires`,
      description: buildEventDescription(domain),
      url: `${BASE_URL}/dashboard`,
      categories: [{ name: "Domain Expiration" }],
    });
  }

  const icsContent = calendar.toString();
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
    lines.push(`Exact expiration: ${domain.expirationDate.toISOString()}`);
  }

  if (domain.ca.certificateExpiryDate) {
    lines.push(
      `SSL certificate expires: ${domain.ca.certificateExpiryDate.toISOString()}`,
    );
  }

  lines.push("");
  lines.push(`Manage your domains: ${BASE_URL}/dashboard`);

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
