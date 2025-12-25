import "server-only";

import type { Logger } from "inngest";
import type { NotificationType } from "@/lib/constants/notifications";
import {
  createNotification,
  updateNotificationResendId,
} from "@/lib/db/repos/notifications";
import { findTrackedDomainById } from "@/lib/db/repos/tracked-domains";
import { getOrCreateUserNotificationPreferences } from "@/lib/db/repos/user-notification-preferences";
import { sendPrettyEmail } from "@/lib/resend";
import type { NotificationOverrides } from "@/lib/schemas";

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
  logger: Logger;
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
      logger.error("Failed to create notification record", {
        trackedDomainId,
        notificationType,
        domainName,
      });
      throw new Error("Failed to create notification record in database");
    }

    // Send email notification if enabled and component provided
    if (shouldSendEmail && emailComponent && emailSubject) {
      const { data, error } = await sendPrettyEmail(
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
    logger.error(`Error sending ${notificationType} notification`, err, {
      domainName,
      userId,
      idempotencyKey,
    });
    throw err;
  }
}
