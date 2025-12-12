"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NOTIFICATION_CATEGORY_INFO,
  type NotificationCategory,
} from "@/lib/constants/notifications";

interface CategoryLabelProps {
  category: NotificationCategory;
  /** Whether to show short label */
  compact?: boolean;
}

const SHORT_LABELS: Record<NotificationCategory, string> = {
  domainExpiry: "Domain",
  certificateExpiry: "Certificate",
  verificationStatus: "Status",
};

/**
 * A label for notification categories with tooltip description.
 */
export function CategoryLabel({
  category,
  compact = false,
}: CategoryLabelProps) {
  const info = NOTIFICATION_CATEGORY_INFO[category];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">
          {compact ? SHORT_LABELS[category] : info.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{info.description}</TooltipContent>
    </Tooltip>
  );
}
