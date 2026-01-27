import type { NotificationType } from "@domainstack/constants";
import {
  CERTIFICATE_EXPIRY_THRESHOLDS,
  CERTIFICATE_THRESHOLD_TO_TYPE,
  DOMAIN_EXPIRY_THRESHOLDS,
  DOMAIN_THRESHOLD_TO_TYPE,
} from "@domainstack/constants";
import {
  IconAlertTriangle,
  IconBell,
  IconCalendarDot,
  IconCloudComputing,
  IconFingerprint,
  IconIdBadge2,
  IconShieldExclamation,
} from "@tabler/icons-react";

// Pre-sorted thresholds (ascending) for efficient lookup - sort once at module load
const SORTED_DOMAIN_THRESHOLDS = [...DOMAIN_EXPIRY_THRESHOLDS].sort(
  (a, b) => a - b,
);
const SORTED_CERTIFICATE_THRESHOLDS = [...CERTIFICATE_EXPIRY_THRESHOLDS].sort(
  (a, b) => a - b,
);

/**
 * Generate a stable idempotency key for Resend.
 * This ensures that if a step retries, Resend won't send duplicate emails.
 *
 * Format: `{trackedDomainId}:{notificationType}`, `{trackedDomainId}:{notificationType}:{discriminator}`, etc.
 */
export function generateIdempotencyKey(...parts: string[]): string {
  return parts.join(":");
}

/**
 * Get the domain expiry notification type for a given number of days remaining.
 * Returns the most urgent (smallest) threshold that applies, or null if none.
 *
 * Example: daysRemaining=14 → returns "domain_expiry_14d" (not 30d)
 */
export function getDomainExpiryNotificationType(
  daysRemaining: number,
): NotificationType | null {
  for (const threshold of SORTED_DOMAIN_THRESHOLDS) {
    if (daysRemaining <= threshold) {
      return DOMAIN_THRESHOLD_TO_TYPE[threshold];
    }
  }
  return null;
}

/**
 * Get the certificate expiry notification type for a given number of days remaining.
 * Returns the most urgent (smallest) threshold that applies, or null if none.
 *
 * Example: daysRemaining=7 → returns "certificate_expiry_7d" (not 14d)
 */
export function getCertificateExpiryNotificationType(
  daysRemaining: number,
): NotificationType | null {
  for (const threshold of SORTED_CERTIFICATE_THRESHOLDS) {
    if (daysRemaining <= threshold) {
      return CERTIFICATE_THRESHOLD_TO_TYPE[threshold];
    }
  }
  return null;
}

export type NotificationSeverity = "critical" | "warning" | "info";

/** Map severity to ShadedIcon color variants */
export function getSeverityIconColor(
  severity: NotificationSeverity,
  isRead: boolean,
): "muted" | "destructive" | "warning" | "default" {
  if (isRead) return "muted";
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "warning";
    default:
      return "default";
  }
}

/** Map notification types to icons */
export function getNotificationIcon(type: string) {
  if (type.startsWith("domain_expiry")) {
    return IconCalendarDot;
  }
  if (type.startsWith("certificate_expiry")) {
    return IconShieldExclamation;
  }
  if (type === "certificate_change") {
    return IconFingerprint;
  }
  if (type === "provider_change") {
    return IconCloudComputing;
  }
  if (type === "registration_change") {
    return IconIdBadge2;
  }
  if (type === "verification_failing" || type === "verification_revoked") {
    return IconAlertTriangle;
  }

  return IconBell;
}

/** Map notification types to severity for color coding */
export function getNotificationSeverity(type: string): NotificationSeverity {
  // Critical: Expires in 1 day, verification revoked
  if (
    type === "domain_expiry_1d" ||
    type === "certificate_expiry_1d" ||
    type === "verification_revoked"
  ) {
    return "critical";
  }

  // Warning: Expires in 7 days or less, verification failing
  if (
    type === "domain_expiry_7d" ||
    type === "certificate_expiry_3d" ||
    type === "certificate_expiry_7d" ||
    type === "verification_failing"
  ) {
    return "warning";
  }

  // Info: Everything else (changes, 14-30 day warnings)
  return "info";
}

/** Get the unread indicator color based on severity */
export function getUnreadIndicatorColor(severity: NotificationSeverity) {
  switch (severity) {
    case "critical":
      return "bg-destructive";
    case "warning":
      return "bg-amber-500";
    default:
      return "bg-blue-500";
  }
}
