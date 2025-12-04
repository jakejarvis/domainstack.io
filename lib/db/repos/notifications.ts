import "server-only";

import { and, eq } from "drizzle-orm";
import type { NotificationType } from "@/lib/constants/notifications";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "notifications" });

// Re-export for convenience
export type { NotificationType } from "@/lib/constants/notifications";

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
 * Update the Resend email ID for a notification after successful send.
 * Used for troubleshooting email delivery issues.
 */
export async function updateNotificationResendId(
  trackedDomainId: string,
  type: NotificationType,
  resendId: string,
) {
  try {
    await db
      .update(notifications)
      .set({ resendId })
      .where(
        and(
          eq(notifications.trackedDomainId, trackedDomainId),
          eq(notifications.type, type),
        ),
      );
    return true;
  } catch (err) {
    logger.error("failed to update notification resend ID", err, {
      trackedDomainId,
      type,
      resendId,
    });
    return false;
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
