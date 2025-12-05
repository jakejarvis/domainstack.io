"use client";

import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_CATEGORY_INFO,
  type NotificationCategory,
} from "@/lib/constants/notifications";

interface GlobalNotificationRowProps {
  category: NotificationCategory;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled: boolean;
}

/**
 * A row for toggling global notification settings.
 */
export function GlobalNotificationRow({
  category,
  enabled,
  onToggle,
  disabled,
}: GlobalNotificationRowProps) {
  const info = NOTIFICATION_CATEGORY_INFO[category];

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <div className="font-medium">{info.label}</div>
        <div className="text-muted-foreground text-sm">{info.description}</div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  );
}
