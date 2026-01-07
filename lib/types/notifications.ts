/**
 * Notification types - Plain TypeScript interfaces.
 *
 * These are internal data structures from our own database,
 * no runtime validation needed.
 */

import type {
  CERTIFICATE_EXPIRY_THRESHOLDS,
  DOMAIN_EXPIRY_THRESHOLDS,
  NOTIFICATION_CATEGORIES,
} from "@/lib/constants/notifications";

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

type DomainExpiryThreshold = (typeof DOMAIN_EXPIRY_THRESHOLDS)[number];
type CertificateExpiryThreshold =
  (typeof CERTIFICATE_EXPIRY_THRESHOLDS)[number];

export type NotificationType =
  | `domain_expiry_${DomainExpiryThreshold}d`
  | `certificate_expiry_${CertificateExpiryThreshold}d`
  | "verification_failing"
  | "verification_revoked"
  | "registration_change"
  | "provider_change"
  | "certificate_change";

// =============================================================================
// Interfaces
// =============================================================================

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
