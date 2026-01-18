import type { IconProps } from "@phosphor-icons/react/dist/lib/types";
import {
  CalendarDotIcon,
  FingerprintIcon,
  IdentificationBadgeIcon,
  PlugsIcon,
  ShieldWarningIcon,
} from "@phosphor-icons/react/ssr";
import type { NotificationCategory } from "./notifications";

/**
 * Notification category UI metadata (icons, labels, descriptions).
 * Separated from pure constants to avoid loading React/icons in Node.js contexts.
 */
export const NOTIFICATION_CATEGORY_INFO: Record<
  NotificationCategory,
  { label: string; description: string; icon: React.FC<IconProps> }
> = {
  providerChanges: {
    label: "Provider Changes",
    description: "Alerts when DNS, hosting, or email providers change",
    icon: PlugsIcon,
  },
  domainExpiry: {
    label: "Domain Expiration",
    description: "Alerts at 30, 14, 7, and 1 day before expiration",
    icon: CalendarDotIcon,
  },
  registrationChanges: {
    label: "Registration Changes",
    description:
      "Alerts when registrar, nameservers, transfer lock, or statuses change",
    icon: IdentificationBadgeIcon,
  },
  certificateExpiry: {
    label: "Certificate Expiration",
    description: "Alerts at 14, 7, 3, and 1 day before expiration",
    icon: ShieldWarningIcon,
  },
  certificateChanges: {
    label: "Certificate Changes",
    description: "Alerts when SSL certificate issuer or subject changes",
    icon: FingerprintIcon,
  },
};
