import type { SQL } from "drizzle-orm";
import { and, count, desc, eq, gt, isNotNull, isNull, like, lt, or, sql } from "drizzle-orm";

import type { NotificationChannel, NotificationType } from "@domainstack/types";

import { db } from "../client";
import { notifications } from "../schema";

export interface CreateNotificationParams {
  userId: string;
  trackedDomainId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  /**
   * Stable logical identity. When set, creation is an atomic claim: a second
   * call with the same key returns the existing row instead of inserting.
   */
  dedupeKey?: string;
}

/** Filter type for notification queries */
export type NotificationFilter = "unread" | "read" | "all";

/**
 * Create a notification record.
 *
 * Without a `dedupeKey` this is a plain insert. With one, the insert is
 * `ON CONFLICT DO NOTHING` on the unique `dedupe_key`, so concurrent callers
 * for the same logical notification produce exactly one row: the winner gets
 * `created: true`, the losers get the existing row with `created: false`.
 *
 * Throws on database errors. Callers run inside workflow steps, where a throw
 * retries the step; swallowing the error would turn a transient blip into a
 * failed run and a duplicate email on the next run.
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<
  | { notification: typeof notifications.$inferSelect | undefined; created: true }
  | { notification: typeof notifications.$inferSelect; created: false }
> {
  const { userId, trackedDomainId, type, title, message, data, channels, dedupeKey } = params;

  const insert = db.insert(notifications).values({
    userId,
    trackedDomainId: trackedDomainId ?? null,
    type,
    title,
    message,
    data: data ?? {},
    channels: channels ?? ["in-app", "email"],
    sentAt: new Date(),
    dedupeKey: dedupeKey ?? null,
  });

  if (!dedupeKey) {
    const [notification] = await insert.returning();
    return { notification, created: true };
  }

  const [inserted] = await insert
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning();
  if (inserted) return { notification: inserted, created: true };

  const [existing] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.dedupeKey, dedupeKey))
    .limit(1);
  if (!existing) {
    throw new Error(`notification dedupe conflict but no row found for key ${dedupeKey}`);
  }
  return { notification: existing, created: false };
}

/**
 * Update the Resend email ID for a notification after successful send.
 */
export async function updateNotificationResendId(
  notificationId: string,
  resendId: string,
): Promise<boolean> {
  try {
    await db.update(notifications).set({ resendId }).where(eq(notifications.id, notificationId));
    return true;
  } catch {
    return false;
  }
}

/** Keyset cursor: the `(sentAt, id)` of the last row of the previous page. */
export interface NotificationCursor {
  sentAt: Date;
  id: string;
}

/**
 * Get notifications for a user with keyset pagination.
 *
 * The cursor is exclusive and self-contained, so it keeps working even if the
 * row it was taken from has since been deleted.
 */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  cursor?: NotificationCursor,
  filter: NotificationFilter = "all",
) {
  const conditions: (SQL | undefined)[] = [
    eq(notifications.userId, userId),
    sql`${notifications.channels} @> '["in-app"]'`,
  ];

  if (cursor) {
    conditions.push(
      or(
        lt(notifications.sentAt, cursor.sentAt),
        and(eq(notifications.sentAt, cursor.sentAt), lt(notifications.id, cursor.id)),
      ),
    );
  }

  if (filter === "unread") {
    conditions.push(isNull(notifications.readAt));
  } else if (filter === "read") {
    conditions.push(isNotNull(notifications.readAt));
  }

  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.sentAt), desc(notifications.id))
    .limit(limit);
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        sql`${notifications.channels} @> '["in-app"]'`,
      ),
    );

  return result?.count ?? 0;
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning();

  return updated.length > 0;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning();

  return updated.length;
}

/**
 * Check if a notification of this type was sent after `since` (default: the
 * last 30 days).
 *
 * Row existence is the dedup signal. A missing `resendId` must not re-open the
 * window — a failed Resend ID write would otherwise make the hourly cron
 * re-notify forever.
 */
export async function hasRecentNotification(
  trackedDomainId: string,
  type: NotificationType,
  since?: Date,
): Promise<boolean> {
  let cutoff = since;
  if (!cutoff) {
    cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
  }

  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.trackedDomainId, trackedDomainId),
        eq(notifications.type, type),
        gt(notifications.sentAt, cutoff),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Get notifications for a tracked domain with optional pagination.
 */
export async function getNotificationsForTrackedDomain(
  trackedDomainId: string,
  limit?: number,
  offset = 0,
) {
  let query = db
    .select()
    .from(notifications)
    .where(eq(notifications.trackedDomainId, trackedDomainId))
    .orderBy(desc(notifications.sentAt))
    .offset(offset)
    .$dynamic();

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  return query;
}

/**
 * Clear all domain expiry notifications for a tracked domain.
 */
export async function clearDomainExpiryNotifications(trackedDomainId: string): Promise<number> {
  const deleted = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.trackedDomainId, trackedDomainId),
        like(notifications.type, "domain_expiry_%"),
      ),
    )
    .returning();

  return deleted.length;
}

/**
 * Clear all certificate expiry notifications for a tracked domain.
 */
export async function clearCertificateExpiryNotifications(
  trackedDomainId: string,
): Promise<number> {
  const deleted = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.trackedDomainId, trackedDomainId),
        like(notifications.type, "certificate_expiry_%"),
      ),
    )
    .returning();

  return deleted.length;
}
