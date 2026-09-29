/**
 * Notification types - Plain TypeScript interfaces.
 */

import type { NotificationCategory, NotificationType } from "./primitives";

/**
 * Data for a single notification item displayed in the UI.
 */
export interface NotificationData {
  id: string;
  trackedDomainId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  sentAt: Date;
  readAt: Date | null;
}

/** Notification channel toggles for in-app and email. */
export interface ChannelToggles {
  inApp: boolean;
  email: boolean;
}

/**
 * User's global notification preferences, one toggle pair per category.
 * Note: Verification notifications are always sent and cannot be disabled.
 */
export type UserNotificationPreferences = Record<NotificationCategory, ChannelToggles>;
