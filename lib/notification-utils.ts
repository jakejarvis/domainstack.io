import {
  AlertTriangle,
  Bell,
  CalendarDays,
  EthernetPort,
  FingerprintPattern,
  IdCardLanyard,
  ShieldAlert,
} from "lucide-react";
import {
  CERTIFICATE_EXPIRY_THRESHOLDS,
  CERTIFICATE_THRESHOLD_TO_TYPE,
  DOMAIN_EXPIRY_THRESHOLDS,
  DOMAIN_THRESHOLD_TO_TYPE,
  type NotificationType,
} from "@/lib/constants/notifications";

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
  // Sort ascending so we find the smallest (most urgent) threshold first
  const sortedThresholds = [...DOMAIN_EXPIRY_THRESHOLDS].sort((a, b) => a - b);
  for (const threshold of sortedThresholds) {
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
  // Sort ascending so we find the smallest (most urgent) threshold first
  const sortedThresholds = [...CERTIFICATE_EXPIRY_THRESHOLDS].sort(
    (a, b) => a - b,
  );
  for (const threshold of sortedThresholds) {
    if (daysRemaining <= threshold) {
      return CERTIFICATE_THRESHOLD_TO_TYPE[threshold];
    }
  }
  return null;
}

export type NotificationSeverity = "critical" | "warning" | "info";

/** Map notification types to icons */
export function getNotificationIcon(type: string) {
  const notificationType = type as NotificationType;

  if (notificationType.startsWith("domain_expiry")) {
    return CalendarDays;
  }
  if (notificationType.startsWith("certificate_expiry")) {
    return ShieldAlert;
  }
  if (notificationType === "certificate_change") {
    return FingerprintPattern;
  }
  if (notificationType === "provider_change") {
    return EthernetPort;
  }
  if (notificationType === "registration_change") {
    return IdCardLanyard;
  }
  if (
    notificationType === "verification_failing" ||
    notificationType === "verification_revoked"
  ) {
    return AlertTriangle;
  }

  return Bell;
}

/** Map notification types to severity for color coding */
export function getNotificationSeverity(type: string): NotificationSeverity {
  const notificationType = type as NotificationType;

  // Critical: Expires in 1 day, verification revoked
  if (
    notificationType === "domain_expiry_1d" ||
    notificationType === "certificate_expiry_1d" ||
    notificationType === "verification_revoked"
  ) {
    return "critical";
  }

  // Warning: Expires in 7 days or less, verification failing
  if (
    notificationType === "domain_expiry_7d" ||
    notificationType === "certificate_expiry_3d" ||
    notificationType === "certificate_expiry_7d" ||
    notificationType === "verification_failing"
  ) {
    return "warning";
  }

  // Info: Everything else (changes, 14-30 day warnings)
  return "info";
}

/** Get colors based on severity and read status */
export function getSeverityColors(
  severity: NotificationSeverity,
  isRead: boolean,
) {
  if (isRead) {
    // Muted colors for read notifications
    return {
      bg: "bg-muted",
      text: "text-muted-foreground",
    };
  }

  // Vibrant colors for unread notifications
  switch (severity) {
    case "critical":
      return {
        bg: "bg-destructive/10",
        text: "text-destructive",
      };
    case "warning":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-500",
      };
    default:
      return {
        bg: "bg-primary/10",
        text: "text-primary",
      };
  }
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
