import "server-only";

import type { Logger } from "pino";
import {
  createNotification,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import { findTrackedDomainById } from "@/lib/db/repos/tracked-domains";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { sendEmail } from "@/lib/resend";
import type { NotificationOverrides, NotificationType } from "@/lib/types";

/**
 * Common configuration for sending notifications.
 */
export interface SendNotificationOptions {
  userId: string;
  userEmail: string;
  trackedDomainId: string;
  domainName: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  idempotencyKey?: string;
  // React component for the email body
  emailComponent?: React.ReactElement;
  // Subject for the email
  emailSubject?: string;
  // Context-specific logger
  logger: unknown;
}

/**
 * Determines whether to send email and/or in-app notifications based on user preferences and overrides.
 */
export async function determineNotificationChannels(
  userId: string,
  trackedDomainId: string,
  category: keyof NotificationOverrides,
): Promise<{ shouldSendEmail: boolean; shouldSendInApp: boolean }> {
  const trackedDomain = await findTrackedDomainById(trackedDomainId);
  if (!trackedDomain) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  const globalPrefs = await getOrCreateUserNotificationPreferences(userId);

  // Check for per-domain overrides first
  const override = trackedDomain.notificationOverrides[category];

  if (override !== undefined) {
    // Use domain-specific override
    return {
      shouldSendEmail: override.email,
      shouldSendInApp: override.inApp,
    };
  }

  // Fall back to global preferences
  const globalPref = globalPrefs[category];
  return {
    shouldSendEmail: globalPref.email,
    shouldSendInApp: globalPref.inApp,
  };
}

/**
 * Consolidated logic for creating a notification record and optionally sending an email.
 * Used by all domain monitoring functions to ensure consistent behavior.
 *
 * ## Idempotency Strategy
 *
 * This function uses a two-layer idempotency approach to handle Inngest retries gracefully:
 *
 * 1. **Database-level deduplication**: Callers typically check `hasRecentNotification()` before
 *    calling this function, preventing duplicate notifications within a time window (usually 30 days).
 *    This protects against multiple Inngest job runs for the same event.
 *
 * 2. **Email-level idempotency**: Resend's idempotency key (format: `{trackedDomainId}:{notificationType}`)
 *    prevents duplicate emails if this function is retried within Resend's idempotency window (~24-48 hours).
 *    This protects against transient failures during email sending.
 *
 * ## Retry Behavior
 *
 * If email sending fails after the notification record is created:
 * - The notification record will show "email" in its channels array
 * - Inngest will retry the entire function
 * - On retry, `hasRecentNotification()` will return true, preventing the caller from invoking this again
 * - If somehow invoked again, Resend's idempotency key prevents duplicate emails
 *
 * This means a notification record might claim an email was sent (in the channels array) even if
 * the send failed. However:
 * - The `resendId` field will be null, indicating the send didn't complete
 * - The user won't receive duplicate emails thanks to the idempotency layers
 * - The in-app notification will still be visible to the user
 *
 * @throws {Error} If notification record creation fails or email sending fails
 */
export async function sendNotification(
  options: SendNotificationOptions,
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  const {
    userId,
    userEmail,
    trackedDomainId,
    domainName,
    notificationType,
    title,
    message,
    idempotencyKey,
    emailComponent,
    emailSubject,
    logger,
  } = options;

  if (!shouldSendEmail && !shouldSendInApp) return false;

  const channels: string[] = [];
  if (shouldSendEmail && emailComponent && emailSubject) channels.push("email");
  if (shouldSendInApp) channels.push("in-app");

  try {
    // Create notification record
    const notification = await createNotification({
      userId,
      trackedDomainId,
      type: notificationType,
      title,
      message,
      data: { domainName },
      channels,
    });

    if (!notification) {
      (logger as Logger).error(
        { trackedDomainId, notificationType, domainName },
        "Failed to create notification record",
      );
      throw new Error("Failed to create notification record in database");
    }

    // Send email notification if enabled and component provided
    if (shouldSendEmail && emailComponent && emailSubject) {
      const { data, error } = await sendEmail(
        {
          to: userEmail,
          subject: emailSubject,
          react: emailComponent,
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      if (error) throw new Error(`Resend error: ${error.message}`);

      // Update notification with email ID
      if (data?.id) {
        await updateNotificationResendId(notification.id, data.id);
      }
    }

    return true;
  } catch (err) {
    (logger as Logger).error(
      { err, domainName, userId, idempotencyKey },
      `Error sending ${notificationType} notification`,
    );
    throw err;
  }
}
