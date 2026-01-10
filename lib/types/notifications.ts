/**
 * Notification types - Plain TypeScript interfaces.
 */

/**
 * Data for a single notification item displayed in the UI.
 * Note: `type` is string to match database storage (text column).
 * Use NotificationType for type-safe comparisons in helper functions.
 */
export interface NotificationData {
  id: string;
  trackedDomainId: string | null;
  type: string;
  title: string;
  message: string;
  sentAt: Date;
  readAt: Date | null;
}

/** Notification channel toggles for in-app and email. */
interface ChannelToggles {
  inApp: boolean;
  email: boolean;
}

/**
 * User's global notification preferences.
 * Note: Verification notifications are always sent and cannot be disabled.
 */
export interface UserNotificationPreferences {
  domainExpiry: ChannelToggles;
  certificateExpiry: ChannelToggles;
  registrationChanges: ChannelToggles;
  providerChanges: ChannelToggles;
  certificateChanges: ChannelToggles;
}

/**
 * Per-domain notification overrides.
 * undefined = inherit from global preferences.
 */
export interface NotificationOverrides {
  domainExpiry?: ChannelToggles;
  certificateExpiry?: ChannelToggles;
  registrationChanges?: ChannelToggles;
  providerChanges?: ChannelToggles;
  certificateChanges?: ChannelToggles;
}
