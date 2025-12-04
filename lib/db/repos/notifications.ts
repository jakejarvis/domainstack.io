import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { notifications, type notificationType } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "notifications" });

export type NotificationType = (typeof notificationType.enumValues)[number];

export type CreateNotificationParams = {
  trackedDomainId: string;
  type: NotificationType;
};

/**
 * Record a sent notification to prevent duplicates.
 */
export async function createNotification(params: CreateNotificationParams) {
  const { trackedDomainId, type } = params;

  try {
    const inserted = await db
      .insert(notifications)
      .values({
        trackedDomainId,
        type,
        sentAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    return inserted[0] ?? null;
  } catch (err) {
    logger.error("failed to create notification record", err, {
      trackedDomainId,
      type,
    });
    return null;
  }
}

/**
 * Check if a notification has already been sent.
 */
export async function hasNotificationBeenSent(
  trackedDomainId: string,
  type: NotificationType,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.trackedDomainId, trackedDomainId),
        eq(notifications.type, type),
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
    .orderBy(notifications.sentAt);

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
