import { and, count, desc, eq, gt, isNotNull, isNull, like, lt, or, sql } from "drizzle-orm";

import type { NotificationType, ReportSection } from "@domainstack/constants";

import { db } from "../client";
import { domains, notifications, userTrackedDomains } from "../schema";

/**
 * Map a notification type to the section of the domain report that
 * surfaces the underlying change. Returns `null` for notifications that
 * don't correspond to a report section (e.g. verification status).
 */
function targetSectionForType(type: string): ReportSection | null {
  if (type.startsWith("domain_expiry_")) return "registration";
  if (type === "registration_change") return "registration";
  if (type.startsWith("certificate_expiry_")) return "certificates";
  if (type === "certificate_change") return "certificates";
  if (type === "provider_change") return "hosting";
  return null;
}

type RawNotificationRow = typeof notifications.$inferSelect & {
  domainName: string | null;
};

export type NotificationListItem = typeof notifications.$inferSelect & {
  domainName: string | null;
  targetSection: ReportSection | null;
};

function enrich(row: RawNotificationRow): NotificationListItem {
  return { ...row, targetSection: targetSectionForType(row.type) };
}

export interface CreateNotificationParams {
  userId: string;
  trackedDomainId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: string[];
}

/** Filter type for notification queries */
export type NotificationFilter = "unread" | "read" | "all";

/**
 * Create a new notification record.
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, trackedDomainId, type, title, message, data, channels } = params;

  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        trackedDomainId: trackedDomainId ?? null,
        type,
        title,
        message,
        data: data ?? {},
        channels: channels ?? ["in-app", "email"],
        sentAt: new Date(),
      })
      .returning();

    return notification;
  } catch {
    return null;
  }
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

/**
 * Get notifications for a user with cursor-based pagination.
 */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  cursor?: string,
  filter: NotificationFilter = "all",
): Promise<NotificationListItem[]> {
  const getReadStatusCondition = () => {
    switch (filter) {
      case "unread":
        return isNull(notifications.readAt);
      case "read":
        return isNotNull(notifications.readAt);
      case "all":
        return;
    }
  };

  const baseSelect = () =>
    db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        trackedDomainId: notifications.trackedDomainId,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        data: notifications.data,
        channels: notifications.channels,
        readAt: notifications.readAt,
        sentAt: notifications.sentAt,
        resendId: notifications.resendId,
        domainName: domains.name,
      })
      .from(notifications)
      .leftJoin(userTrackedDomains, eq(userTrackedDomains.id, notifications.trackedDomainId))
      .leftJoin(domains, eq(domains.id, userTrackedDomains.domainId));

  if (!cursor) {
    const conditions = [
      eq(notifications.userId, userId),
      sql`${notifications.channels} @> '["in-app"]'`,
    ];

    const readStatusCondition = getReadStatusCondition();
    if (readStatusCondition) {
      conditions.push(readStatusCondition);
    }

    const rows = await baseSelect()
      .where(and(...conditions))
      .orderBy(desc(notifications.sentAt), desc(notifications.id))
      .limit(limit);

    return rows.map(enrich);
  }

  const [cursorNotif] = await db
    .select({ id: notifications.id, sentAt: notifications.sentAt })
    .from(notifications)
    .where(and(eq(notifications.id, cursor), eq(notifications.userId, userId)))
    .limit(1);

  if (!cursorNotif) {
    const conditions = [
      eq(notifications.userId, userId),
      sql`${notifications.channels} @> '["in-app"]'`,
    ];

    const readStatusCondition = getReadStatusCondition();
    if (readStatusCondition) {
      conditions.push(readStatusCondition);
    }

    const rows = await baseSelect()
      .where(and(...conditions))
      .orderBy(desc(notifications.sentAt), desc(notifications.id))
      .limit(limit);

    return rows.map(enrich);
  }

  const conditions = [
    eq(notifications.userId, userId),
    or(
      lt(notifications.sentAt, cursorNotif.sentAt),
      and(eq(notifications.sentAt, cursorNotif.sentAt), lt(notifications.id, cursorNotif.id)),
    ),
    sql`${notifications.channels} @> '["in-app"]'`,
  ];

  const readStatusCondition = getReadStatusCondition();
  if (readStatusCondition) {
    conditions.push(readStatusCondition);
  }

  const rows = await baseSelect()
    .where(and(...conditions))
    .orderBy(desc(notifications.sentAt), desc(notifications.id))
    .limit(limit);

  return rows.map(enrich);
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
  try {
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    return updated.length > 0;
  } catch {
    return false;
  }
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  try {
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning();

    return updated.length;
  } catch {
    return 0;
  }
}

/**
 * Check if a notification of this type has been FULLY sent recently.
 */
export async function hasRecentNotification(
  trackedDomainId: string,
  type: NotificationType,
  days = 30,
): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const rows = await db
    .select({
      channels: notifications.channels,
      resendId: notifications.resendId,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.trackedDomainId, trackedDomainId),
        eq(notifications.type, type),
        gt(notifications.sentAt, cutoff),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return false;
  }

  const [notification] = rows;
  const channels = (notification.channels as string[]) ?? [];

  if (channels.includes("email") && !notification.resendId) {
    return false;
  }

  return true;
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
 * Delete all notifications for a tracked domain.
 */
export async function deleteNotificationsForTrackedDomain(
  trackedDomainId: string,
): Promise<boolean> {
  try {
    await db.delete(notifications).where(eq(notifications.trackedDomainId, trackedDomainId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all domain expiry notifications for a tracked domain.
 */
export async function clearDomainExpiryNotifications(trackedDomainId: string): Promise<number> {
  try {
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
  } catch {
    return 0;
  }
}

/**
 * Clear all certificate expiry notifications for a tracked domain.
 */
export async function clearCertificateExpiryNotifications(
  trackedDomainId: string,
): Promise<number> {
  try {
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
  } catch {
    return 0;
  }
}
