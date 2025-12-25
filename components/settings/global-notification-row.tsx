"use client";

import { Info } from "lucide-react";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_CATEGORY_INFO,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import { cn } from "@/lib/utils";

interface GlobalNotificationRowProps {
  category: NotificationCategory;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  onToggle: (type: "email" | "inApp", enabled: boolean) => void;
  disabled: boolean;
}

/**
 * A row for toggling global notification settings.
 * Clean, minimal design with subtle hover states and icon indicators.
 */
export function GlobalNotificationRow({
  category,
  emailEnabled,
  inAppEnabled,
  onToggle,
  disabled,
}: GlobalNotificationRowProps) {
  const info = NOTIFICATION_CATEGORY_INFO[category];
  const Icon = info.icon;

  const anyEnabled = emailEnabled || inAppEnabled;

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors",
        "hover:bg-muted/50",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {/* Icon + Label */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Icon indicator */}
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            anyEnabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </div>

        {/* Label with info tooltip */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className={cn(
              "font-medium text-sm",
              anyEnabled ? "text-foreground" : "text-foreground/70",
            )}
          >
            {info.label}
          </span>
          <ResponsiveTooltip>
            <ResponsiveTooltipTrigger
              nativeButton={false}
              render={
                <span className="inline-flex text-foreground/70">
                  <Info className="size-3.5" />
                </span>
              }
            />
            <ResponsiveTooltipContent className="max-w-xs">
              {info.description}
            </ResponsiveTooltipContent>
          </ResponsiveTooltip>
        </div>
      </div>

      {/* Switches */}
      <div className="flex items-center gap-2 sm:gap-6">
        {/* In-App Switch */}
        <div className="flex w-12 justify-center sm:w-16">
          <Switch
            checked={inAppEnabled}
            onCheckedChange={(v) => onToggle("inApp", v)}
            disabled={disabled}
            className="cursor-pointer"
            aria-label={`Toggle in-app notifications for ${info.label}`}
          />
        </div>

        {/* Email Switch */}
        <div className="flex w-12 justify-center sm:w-16">
          <Switch
            checked={emailEnabled}
            onCheckedChange={(v) => onToggle("email", v)}
            disabled={disabled}
            className="cursor-pointer"
            aria-label={`Toggle email notifications for ${info.label}`}
          />
        </div>
      </div>
    </div>
  );
}
