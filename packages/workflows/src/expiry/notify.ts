/**
 * Expiry notification steps used only by the expiry workflow.
 */

import type { NotificationType } from "@domainstack/types";

import type { NotificationChannels } from "../steps/notifications";

// ============================================================================
// Expiry notification helpers
// ============================================================================

/**
 * Step: Check user notification preferences for expiry notifications.
 *
 * Respects the muted flag on tracked domains.
 */
export async function checkExpiryPreferencesStep(
  userId: string,
  muted: boolean,
  preferenceKey: "domainExpiry" | "certificateExpiry",
): Promise<NotificationChannels> {
  "use step";

  // Muted domains receive no notifications
  if (muted) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  const { getUserNotificationPreferences } =
    await import("@domainstack/db/queries/user-notification-preferences");

  const globalPrefs = await getUserNotificationPreferences(userId);

  return {
    shouldSendEmail: globalPrefs[preferenceKey].email,
    shouldSendInApp: globalPrefs[preferenceKey].inApp,
  };
}

/**
 * Step: Check if a notification was already sent for this domain and type.
 */
export async function checkAlreadySentStep(
  trackedDomainId: string,
  notificationType: NotificationType,
): Promise<boolean> {
  "use step";

  const { hasRecentNotification } = await import("@domainstack/db/queries/notifications");

  return await hasRecentNotification(trackedDomainId, notificationType);
}
