import {
  CalendarDays,
  EthernetPort,
  FingerprintPattern,
  IdCardLanyard,
  type LucideIcon,
  ShieldAlert,
} from "lucide-react";

/**
 * Notification system constants and types.
 * Defines notification categories, thresholds, and type strings.
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

// Category metadata for UI display
export const NOTIFICATION_CATEGORY_INFO: Record<
  NotificationCategory,
  { label: string; description: string; icon: LucideIcon }
> = {
  providerChanges: {
    label: "Provider Changes",
    description: "Alerts when DNS, hosting, or email providers change",
    icon: EthernetPort,
  },
  domainExpiry: {
    label: "Domain Expiration",
    description: "Alerts at 30, 14, 7, and 1 day before expiration",
    icon: CalendarDays,
  },
  registrationChanges: {
    label: "Registration Changes",
    description:
      "Alerts when registrar, nameservers, transfer lock, or statuses change",
    icon: IdCardLanyard,
  },
  certificateExpiry: {
    label: "Certificate Expiration",
    description: "Alerts at 14, 7, 3, and 1 day before expiration",
    icon: ShieldAlert,
  },
  certificateChanges: {
    label: "Certificate Changes",
    description: "Alerts when SSL certificate issuer or subject changes",
    icon: FingerprintPattern,
  },
};

// Notification thresholds (days before expiration)
export const DOMAIN_EXPIRY_THRESHOLDS = [30, 14, 7, 1] as const;
export const CERTIFICATE_EXPIRY_THRESHOLDS = [14, 7, 3, 1] as const;

// Dashboard "expiring soon" threshold (first notification threshold)
export const EXPIRING_SOON_DAYS = DOMAIN_EXPIRY_THRESHOLDS[0];

export type DomainExpiryThreshold = (typeof DOMAIN_EXPIRY_THRESHOLDS)[number];
export type CertificateExpiryThreshold =
  (typeof CERTIFICATE_EXPIRY_THRESHOLDS)[number];

// Notification type strings (used in notifications table)
export type NotificationType =
  | `domain_expiry_${DomainExpiryThreshold}d`
  | `certificate_expiry_${CertificateExpiryThreshold}d`
  | "verification_failing"
  | "verification_revoked"
  | "registration_change"
  | "provider_change"
  | "certificate_change";

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
