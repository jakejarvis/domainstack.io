/**
 * Notification types - Plain TypeScript interfaces.
 *
 * These are internal data structures from our own database,
 * no runtime validation needed.
 */

/**
 * Data for a single notification item displayed in the UI.
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

/**
 * Notification channels - each category has toggles for in-app and email.
 */
export interface NotificationChannels {
  inApp: boolean;
  email: boolean;
}

/**
 * User's global notification preferences.
 * All fields are required objects with channel booleans representing the default for all domains.
 * Note: Verification notifications are always sent and cannot be disabled.
 */
export interface UserNotificationPreferences {
  domainExpiry: NotificationChannels;
  certificateExpiry: NotificationChannels;
  registrationChanges: NotificationChannels;
  providerChanges: NotificationChannels;
  certificateChanges: NotificationChannels;
}

/**
 * Per-domain notification overrides.
 * All fields are optional - undefined means "inherit from global preferences".
 * Setting to an object with channel booleans explicitly overrides the global setting for that domain.
 */
export interface NotificationOverrides {
  domainExpiry?: NotificationChannels;
  certificateExpiry?: NotificationChannels;
  registrationChanges?: NotificationChannels;
  providerChanges?: NotificationChannels;
  certificateChanges?: NotificationChannels;
}

/**
 * Input type for updating global notification preferences.
 * All fields optional to allow partial updates.
 */
export interface UpdateNotificationPreferences {
  domainExpiry?: NotificationChannels;
  certificateExpiry?: NotificationChannels;
  registrationChanges?: NotificationChannels;
  providerChanges?: NotificationChannels;
  certificateChanges?: NotificationChannels;
}
