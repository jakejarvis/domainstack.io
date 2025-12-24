import "server-only";

import { and, count, desc, eq, gt, isNull, like, lt, sql } from "drizzle-orm";
import type { NotificationType } from "@/lib/constants/notifications";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "notifications" });

// Re-export for convenience
export type { NotificationType } from "@/lib/constants/notifications";

export type CreateNotificationParams = {
  userId: string;
  trackedDomainId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: string[];
};

/**
 * Create a new notification record.
 * Used for both in-app notifications and email logging.
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, trackedDomainId, type, title, message, data, channels } =
    params;

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
        channels: channels ?? ["in-app", "email"], // Default to both if not specified
        sentAt: new Date(),
      })
      .returning();

    return notification;
  } catch (err) {
    logger.error("failed to create notification record", err, { userId, type });
    return null;
  }
}

/**
 * Update the Resend email ID for a notification after successful send.
 * Used for troubleshooting email delivery issues.
 */
export async function updateNotificationResendId(
  notificationId: string,
  resendId: string,
) {
  try {
    await db
      .update(notifications)
      .set({ resendId })
      .where(eq(notifications.id, notificationId));
    return true;
  } catch (err) {
    logger.error("failed to update notification resend ID", err, {
      notificationId,
      resendId,
    });
    return false;
  }
}

/**
 * Get all notifications for a user (in-app inbox) with cursor-based pagination.
 */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  cursor?: string,
) {
  if (!cursor) {
    // First page - no cursor
    return db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          // Only show notifications that include 'in-app' channel
          sql`${notifications.channels} @> '["in-app"]'`,
        ),
      )
      .orderBy(desc(notifications.sentAt))
      .limit(limit);
  }

  // Get the cursor notification to find its sentAt timestamp
  const [cursorNotif] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, cursor))
    .limit(1);

  if (!cursorNotif) {
    // Invalid cursor, return empty
    return [];
  }

  // Fetch notifications sent before the cursor (older notifications)
  return db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        lt(notifications.sentAt, cursorNotif.sentAt),
        // Only show notifications that include 'in-app' channel
        sql`${notifications.channels} @> '["in-app"]'`,
      ),
    )
    .orderBy(desc(notifications.sentAt))
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
        // Only count in-app notifications
        sql`${notifications.channels} @> '["in-app"]'`,
      ),
    );

  return result?.count ?? 0;
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(notificationId: string, userId: string) {
  try {
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      )
      .returning();

    return updated.length > 0;
  } catch (err) {
    logger.error("failed to mark notification as read", err, {
      notificationId,
      userId,
    });
    return false;
  }
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
  try {
    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      )
      .returning();

    return updated.length;
  } catch (err) {
    logger.error("failed to mark all notifications as read", err, { userId });
    return 0;
  }
}

/**
 * Check if a notification of this type has been sent RECENTLY.
 * Since we removed the unique constraint, this prevents notification spam.
 */
export async function hasRecentNotification(
  trackedDomainId: string,
  type: NotificationType,
  days = 30,
): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const rows = await db
    .select()
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
 * Get all notifications for a tracked domain.
 */
export async function getNotificationsForTrackedDomain(
  trackedDomainId: string,
) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.trackedDomainId, trackedDomainId))
    .orderBy(desc(notifications.sentAt));

  return rows;
}

/**
 * Delete all notifications for a tracked domain.
 * Called when a tracked domain is removed.
 */
export async function deleteNotificationsForTrackedDomain(
  trackedDomainId: string,
) {
  try {
    await db
      .delete(notifications)
      .where(eq(notifications.trackedDomainId, trackedDomainId));
    return true;
  } catch (err) {
    logger.error("failed to delete notifications", err, { trackedDomainId });
    return false;
  }
}

/**
 * Clear all domain expiry notifications for a tracked domain.
 * Called when a domain renewal is detected (expiration date moved forward).
 * This allows fresh notifications to be sent for the new expiration cycle.
 */
export async function clearDomainExpiryNotifications(
  trackedDomainId: string,
): Promise<number> {
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

    if (deleted.length > 0) {
      logger.info("cleared domain expiry notifications for renewal", {
        trackedDomainId,
        count: deleted.length,
      });
    }

    return deleted.length;
  } catch (err) {
    logger.error("failed to clear domain expiry notifications", err, {
      trackedDomainId,
    });
    return 0;
  }
}

/**
 * Clear all certificate expiry notifications for a tracked domain.
 * Called when a certificate renewal is detected (validTo date moved forward).
 * This allows fresh notifications to be sent for the new certificate.
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

    if (deleted.length > 0) {
      logger.info("cleared certificate expiry notifications for renewal", {
        trackedDomainId,
        count: deleted.length,
      });
    }

    return deleted.length;
  } catch (err) {
    logger.error("failed to clear certificate expiry notifications", err, {
      trackedDomainId,
    });
    return 0;
  }
}
