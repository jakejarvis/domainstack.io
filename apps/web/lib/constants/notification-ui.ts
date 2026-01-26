import {
  IconCalendarDot,
  IconFingerprint,
  IconIdBadge2,
  IconPlug,
  IconShieldExclamation,
  type TablerIcon,
} from "@tabler/icons-react";
import type { NotificationCategory } from "./notifications";

/**
 * Notification category UI metadata (icons, labels, descriptions).
 * Separated from pure constants to avoid loading React/icons in Node.js contexts.
 */
export const NOTIFICATION_CATEGORY_INFO: Record<
  NotificationCategory,
  { label: string; description: string; icon: TablerIcon }
> = {
  providerChanges: {
    label: "Provider Changes",
    description: "Alerts when DNS, hosting, or email providers change",
    icon: IconPlug,
  },
  domainExpiry: {
    label: "Domain Expiration",
    description: "Alerts at 30, 14, 7, and 1 day before expiration",
    icon: IconCalendarDot,
  },
  registrationChanges: {
    label: "Registration Changes",
    description:
      "Alerts when registrar, nameservers, transfer lock, or statuses change",
    icon: IconIdBadge2,
  },
  certificateExpiry: {
    label: "Certificate Expiration",
    description: "Alerts at 14, 7, 3, and 1 day before expiration",
    icon: IconShieldExclamation,
  },
  certificateChanges: {
    label: "Certificate Changes",
    description: "Alerts when SSL certificate issuer or subject changes",
    icon: IconFingerprint,
  },
};
