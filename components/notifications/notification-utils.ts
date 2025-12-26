import {
  AlertTriangle,
  Bell,
  CalendarDays,
  EthernetPort,
  FingerprintPattern,
  IdCardLanyard,
  ShieldAlert,
} from "lucide-react";
import type { NotificationType } from "@/lib/constants/notifications";

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
