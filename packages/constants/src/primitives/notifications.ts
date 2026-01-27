/**
 * Notification system constants and derived types.
 * Note: UI metadata (icons) is in apps/web/lib/constants/notification-ui.ts to avoid loading React in Node.js contexts.
 */

// Valid notification channels
export const NOTIFICATION_CHANNELS = ["in-app", "email"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// Notification categories for user preferences
export const NOTIFICATION_CATEGORIES = [
  "providerChanges",
  "domainExpiry",
  "registrationChanges",
  "certificateExpiry",
  "certificateChanges",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

// Notification thresholds (days before expiration)
export const DOMAIN_EXPIRY_THRESHOLDS = [30, 14, 7, 1] as const;
export const CERTIFICATE_EXPIRY_THRESHOLDS = [14, 7, 3, 1] as const;

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

// Dashboard "expiring soon" threshold (first notification threshold)
// biome-ignore lint/nursery/useDestructuring: This is a constant
export const EXPIRING_SOON_DAYS = DOMAIN_EXPIRY_THRESHOLDS[0];

// Mapping from threshold to notification type
export const DOMAIN_THRESHOLD_TO_TYPE: Record<
  DomainExpiryThreshold,
  NotificationType
> = {
  30: "domain_expiry_30d",
  14: "domain_expiry_14d",
  7: "domain_expiry_7d",
  1: "domain_expiry_1d",
};

export const CERTIFICATE_THRESHOLD_TO_TYPE: Record<
  CertificateExpiryThreshold,
  NotificationType
> = {
  14: "certificate_expiry_14d",
  7: "certificate_expiry_7d",
  3: "certificate_expiry_3d",
  1: "certificate_expiry_1d",
};
