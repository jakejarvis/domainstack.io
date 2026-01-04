import type { NextRequest } from "next/server";
import { after } from "next/server";
import { generateCalendarFeed } from "@/lib/calendar/generate";
import {
  recordCalendarFeedAccess,
  validateCalendarFeedToken,
} from "@/lib/db/repos/calendar-feeds";
import { getTrackedDomainsForUser } from "@/lib/db/repos/tracked-domains";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "calendar-feed" });

/**
 * GET /api/calendar/user.ics?token=...
 *
 * Returns an iCalendar feed of domain expiration dates.
 * Authentication is via token query parameter (capability URL pattern).
 */
export async function GET(request: NextRequest) {
  // 1. Parse token from query
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new Response("Missing token parameter", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 2. Validate token
  const validation = await validateCalendarFeedToken(token);

  if (!validation.valid) {
    // Log without exposing full token (only prefix for debugging)
    logger.warn(
      { tokenPrefix: token.slice(0, 12), reason: validation.reason },
      "invalid calendar feed token",
    );

    // Use same error message for both cases to prevent enumeration
    return new Response("Invalid or disabled feed", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // 3. Record access in background (fire-and-forget)
  after(() => recordCalendarFeedAccess(token));

  // 4. Fetch user's domains
  const domains = await getTrackedDomainsForUser(validation.userId, {
    includeArchived: false,
    includeDnsRecords: false,
  });

  // 5. Generate ICS content
  const { icsContent, etag, eventCount } = generateCalendarFeed(domains);

  logger.debug(
    { userId: validation.userId, eventCount },
    "generated calendar feed",
  );

  // 6. Handle conditional request (If-None-Match)
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch === `"${etag}"`) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: `"${etag}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // 7. Return calendar response
  return new Response(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="domainstack-expirations.ics"',
      "Cache-Control": "private, max-age=3600",
      ETag: `"${etag}"`,
    },
  });
}
