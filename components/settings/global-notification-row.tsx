"use client";

import { BadgeAlert, CalendarDays, Info, ShieldAlert } from "lucide-react";
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
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled: boolean;
}

const CATEGORY_ICONS: Record<
  NotificationCategory,
  React.ComponentType<{ className?: string }>
> = {
  domainExpiry: CalendarDays,
  certificateExpiry: ShieldAlert,
  verificationStatus: BadgeAlert,
};

/**
 * A row for toggling global notification settings.
 * Clean, minimal design with subtle hover states and icon indicators.
 */
export function GlobalNotificationRow({
  category,
  enabled,
  onToggle,
  disabled,
}: GlobalNotificationRowProps) {
  const info = NOTIFICATION_CATEGORY_INFO[category];
  const Icon = CATEGORY_ICONS[category];

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking the info button or switch
    if ((e.target as HTMLElement).closest("button, [role=switch]")) {
      return;
    }
    if (!disabled) {
      onToggle(!enabled);
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onToggle(!enabled);
        }
      }}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
        "hover:bg-muted/50",
        disabled && "pointer-events-none",
      )}
    >
      {/* Icon indicator */}
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          enabled
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </div>

      {/* Label with info tooltip */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="font-medium text-sm">{info.label}</span>
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

      {/* Toggle */}
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="shrink-0 cursor-pointer"
      />
    </div>
  );
}
