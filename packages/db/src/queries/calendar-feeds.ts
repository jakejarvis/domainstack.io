import crypto from "node:crypto";
import { eq, type InferSelectModel, sql } from "drizzle-orm";
import { db } from "../client";
import { calendarFeeds } from "../schema";

/**
 * Token prefix for calendar feed tokens.
 */
const TOKEN_PREFIX = "ck_";

/**
 * Generate a cryptographically secure calendar feed token.
 */
function generateCalendarFeedToken(): string {
  const bytes = crypto.randomBytes(32);
  return `${TOKEN_PREFIX}${bytes.toString("base64url")}`;
}

type CalendarFeedSelect = InferSelectModel<typeof calendarFeeds>;

export type CalendarFeedValidation =
  | { valid: true; userId: string; feedId: string }
  | { valid: false; reason: "invalid" };

/**
 * Get a user's calendar feed record if it exists.
 */
export async function getCalendarFeed(
  userId: string,
): Promise<CalendarFeedSelect | null> {
  const [feed] = await db
    .select()
    .from(calendarFeeds)
    .where(eq(calendarFeeds.userId, userId))
    .limit(1);

  return feed ?? null;
}

/**
 * Enable (create or re-enable) a calendar feed for a user.
 */
export async function enableCalendarFeed(
  userId: string,
): Promise<CalendarFeedSelect> {
  const token = generateCalendarFeedToken();

  const [feed] = await db
    .insert(calendarFeeds)
    .values({
      userId,
      token,
    })
    .onConflictDoUpdate({
      target: calendarFeeds.userId,
      set: { enabled: true },
    })
    .returning();

  return feed;
}

/**
 * Disable a calendar feed for a user.
 */
export async function disableCalendarFeed(
  userId: string,
): Promise<CalendarFeedSelect | null> {
  const [updated] = await db
    .update(calendarFeeds)
    .set({ enabled: false })
    .where(eq(calendarFeeds.userId, userId))
    .returning();

  return updated ?? null;
}

/**
 * Rotate the calendar feed token for a user.
 */
export async function rotateCalendarFeedToken(
  userId: string,
): Promise<CalendarFeedSelect | null> {
  const newToken = generateCalendarFeedToken();

  const [updated] = await db
    .update(calendarFeeds)
    .set({
      token: newToken,
      rotatedAt: new Date(),
      lastAccessedAt: null,
      accessCount: 0,
    })
    .where(eq(calendarFeeds.userId, userId))
    .returning();

  return updated ?? null;
}

/**
 * Delete a calendar feed for a user entirely.
 */
export async function deleteCalendarFeed(userId: string): Promise<boolean> {
  const result = await db
    .delete(calendarFeeds)
    .where(eq(calendarFeeds.userId, userId))
    .returning({ id: calendarFeeds.id });

  return result.length > 0;
}

/**
 * Validate a calendar feed token and return the associated user ID.
 */
export async function validateCalendarFeedToken(
  token: string,
): Promise<CalendarFeedValidation> {
  const [feed] = await db
    .select({
      id: calendarFeeds.id,
      userId: calendarFeeds.userId,
      enabled: calendarFeeds.enabled,
    })
    .from(calendarFeeds)
    .where(eq(calendarFeeds.token, token))
    .limit(1);

  if (!feed || !feed.enabled) {
    return { valid: false, reason: "invalid" };
  }

  return { valid: true, userId: feed.userId, feedId: feed.id };
}

/**
 * Record an access to the calendar feed.
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
