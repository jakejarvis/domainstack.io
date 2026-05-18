/**
 * Isomorphic domain-expiry calendar event builder.
 *
 * Pure, dependency-light (only `@domainstack/types`) so it is safe to import
 * from both the web ICS feed (`apps/web/lib/calendar.ts`) and the React Native
 * calendar sync engine (`apps/native/src/lib/calendar-sync.ts`). Keeping the
 * event-shaping logic in one place guarantees the webcal feed and the
 * device-local calendar emit byte-identical titles/notes for the same domain.
 *
 * No `ts-ics` / `node:crypto` / `server-only` imports — those stay web-only.
 */

import type { TrackedDomainWithDetails } from "@domainstack/types";

/**
 * A single domain-expiration calendar event, normalized and renderer-agnostic.
 * Consumers map this onto their own event representation (ICS `VEVENT`,
 * EventKit/CalendarProvider event, etc.).
 */
export interface DomainExpiryEvent {
  /** Stable per-user UID: `${trackedDomainId}@domainstack.io`. */
  uid: string;
  /** The tracked-domain row id (used as the native dedupe key). */
  trackedDomainId: string;
  /** The domain name, e.g. `example.com`. */
  domainName: string;
  /** Expiration date — never null (non-expiring domains are filtered out). */
  expirationDate: Date;
  /** Event title, e.g. `🌐 example.com expires`. */
  summary: string;
  /** Multi-line notes: domain / registrar / exact time / SSL / deep link. */
  description: string;
  /** Deep link back into the dashboard for this domain. */
  url: string;
}

export interface BuildDomainExpiryEventsOptions {
  /** Origin used to build the dashboard deep link (no trailing slash). */
  baseUrl: string;
}

function dashboardUrl(baseUrl: string, trackedDomainId: string): string {
  return `${baseUrl}/dashboard?domainId=${trackedDomainId}`;
}

/**
 * Build the event notes/description for a domain.
 *
 * Mirrors the historical `buildEventDescription` in `apps/web/lib/calendar.ts`
 * exactly so the refactored ICS feed stays byte-compatible. `expirationDate` is
 * guaranteed present here because callers filter first.
 */
function buildEventDescription(
  domain: TrackedDomainWithDetails,
  expirationDate: Date,
  baseUrl: string,
): string {
  const lines: string[] = [`Domain: ${domain.domainName}`];

  if (domain.registrar.name) {
    lines.push(`Registrar: ${domain.registrar.name}`);
  }

  lines.push("");
  lines.push(`Exact time: ${expirationDate.toISOString()}`);

  if (domain.ca.certificateExpiryDate) {
    lines.push(`SSL certificate expires: ${domain.ca.certificateExpiryDate.toISOString()}`);
  }

  lines.push("");
  lines.push(`View more details: ${dashboardUrl(baseUrl, domain.id)}`);

  return lines.join("\n");
}

/**
 * Project tracked domains into deterministic, calendar-ready expiry events.
 *
 * - Keeps only verified domains that have an expiration date (parity with the
 *   web ICS feed — unverified or non-expiring domains are excluded).
 * - Sorts by `uid` so the output order is stable regardless of DB row order
 *   (matters for diffing on native and for a stable feed on web).
 */
export function buildDomainExpiryEvents(
  domains: TrackedDomainWithDetails[],
  opts: BuildDomainExpiryEventsOptions,
): DomainExpiryEvent[] {
  const events: DomainExpiryEvent[] = [];

  for (const domain of domains) {
    if (!domain.verified || domain.expirationDate === null) continue;
    const expirationDate = domain.expirationDate;

    events.push({
      uid: `${domain.id}@domainstack.io`,
      trackedDomainId: domain.id,
      domainName: domain.domainName,
      expirationDate,
      summary: `🌐 ${domain.domainName} expires`,
      description: buildEventDescription(domain, expirationDate, opts.baseUrl),
      url: dashboardUrl(opts.baseUrl, domain.id),
    });
  }

  events.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return events;
}
