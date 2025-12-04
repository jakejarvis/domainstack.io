"use client";

import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{info.label}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>{info.description}</TooltipContent>
            </Tooltip>
          </div>
          <div className="text-muted-foreground text-sm">
            {info.description}
          </div>
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  );
}
