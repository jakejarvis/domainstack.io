import "server-only";

import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { calendarFeeds } from "@/lib/db/schema";

/**
 * Token prefix for calendar feed tokens.
 * Makes tokens easily identifiable in logs and debugging.
 */
const TOKEN_PREFIX = "dscal_";

/**
 * Generate a cryptographically secure calendar feed token.
 * Format: dscal_{32-byte-base64url} (~43 chars after prefix)
 */
export function generateCalendarFeedToken(): string {
  const bytes = crypto.randomBytes(32);
  return `${TOKEN_PREFIX}${bytes.toString("base64url")}`;
}

export type CalendarFeed = typeof calendarFeeds.$inferSelect;

/**
 * Get a user's calendar feed record if it exists.
 */
export async function getCalendarFeed(
  userId: string,
): Promise<CalendarFeed | null> {
  const [feed] = await db
    .select()
    .from(calendarFeeds)
    .where(eq(calendarFeeds.userId, userId))
    .limit(1);

  return feed ?? null;
}

/**
 * Enable (create or re-enable) a calendar feed for a user.
 * If a feed already exists but is disabled, re-enables it.
 * If no feed exists, creates a new one with a fresh token.
 */
export async function enableCalendarFeed(
  userId: string,
): Promise<CalendarFeed> {
  // Check if feed already exists
  const existing = await getCalendarFeed(userId);

  if (existing) {
    // Re-enable if disabled
    if (!existing.enabled) {
      const [updated] = await db
        .update(calendarFeeds)
        .set({ enabled: true })
        .where(eq(calendarFeeds.id, existing.id))
        .returning();
      return updated;
    }
    // Already enabled, just return
    return existing;
  }

  // Create new feed with fresh token
  const token = generateCalendarFeedToken();
  const [created] = await db
    .insert(calendarFeeds)
    .values({
      userId,
      token,
    })
    .returning();

  return created;
}

/**
 * Disable a calendar feed for a user.
 * The token is preserved so the feed can be re-enabled later.
 * Returns null if no feed exists.
 */
export async function disableCalendarFeed(
  userId: string,
): Promise<CalendarFeed | null> {
  const [updated] = await db
    .update(calendarFeeds)
    .set({ enabled: false })
    .where(eq(calendarFeeds.userId, userId))
    .returning();

  return updated ?? null;
}

/**
 * Rotate the calendar feed token for a user.
 * Generates a new token, invalidating the old URL.
 * Returns null if no feed exists.
 */
export async function rotateCalendarFeedToken(
  userId: string,
): Promise<CalendarFeed | null> {
  const newToken = generateCalendarFeedToken();

  const [updated] = await db
    .update(calendarFeeds)
    .set({
      token: newToken,
      rotatedAt: new Date(),
      // Reset access tracking on rotation
      lastAccessedAt: null,
      accessCount: 0,
    })
    .where(eq(calendarFeeds.userId, userId))
    .returning();

  return updated ?? null;
}

/**
 * Delete a calendar feed for a user entirely.
 * Used when user wants to completely remove the feed.
 */
export async function deleteCalendarFeed(userId: string): Promise<boolean> {
  const result = await db
    .delete(calendarFeeds)
    .where(eq(calendarFeeds.userId, userId))
    .returning({ id: calendarFeeds.id });

  return result.length > 0;
}

export type CalendarFeedValidation =
  | { valid: true; userId: string; feedId: string }
  | { valid: false; reason: "not_found" | "disabled" };

/**
 * Validate a calendar feed token and return the associated user ID.
 * Used by the feed endpoint to authenticate requests.
 */
export async function validateCalendarFeedToken(
  token: string,
): Promise<CalendarFeedValidation> {
  // Quick format check
  if (!token.startsWith(TOKEN_PREFIX)) {
    return { valid: false, reason: "not_found" };
  }

  const [feed] = await db
    .select({
      id: calendarFeeds.id,
      userId: calendarFeeds.userId,
      enabled: calendarFeeds.enabled,
    })
    .from(calendarFeeds)
    .where(eq(calendarFeeds.token, token))
    .limit(1);

  if (!feed) {
    return { valid: false, reason: "not_found" };
  }

  if (!feed.enabled) {
    return { valid: false, reason: "disabled" };
  }

  return { valid: true, userId: feed.userId, feedId: feed.id };
}

/**
 * Record an access to the calendar feed.
 * Updates last accessed timestamp and increments access count.
 * This is called in fire-and-forget mode via after().
 */
export async function recordCalendarFeedAccess(token: string): Promise<void> {
  await db
    .update(calendarFeeds)
    .set({
      lastAccessedAt: new Date(),
      accessCount: sql`${calendarFeeds.accessCount} + 1`,
    })
    .where(eq(calendarFeeds.token, token));
}
