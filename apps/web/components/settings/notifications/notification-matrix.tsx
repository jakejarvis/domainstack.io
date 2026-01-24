"use client";

import { InfoIcon } from "@phosphor-icons/react/ssr";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { NOTIFICATION_CATEGORY_INFO } from "@/lib/constants/notification-ui";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import type { UserNotificationPreferences } from "@/lib/types/notifications";
import { cn } from "@/lib/utils";

interface NotificationMatrixProps {
  preferences: UserNotificationPreferences;
  onToggle: (
    category: NotificationCategory,
    type: "email" | "inApp",
    enabled: boolean,
  ) => void;
  disabled?: boolean;
}

/**
 * A clean matrix-style notification preferences grid.
 * Displays categories as rows with Web/Email checkboxes as columns.
 */
export function NotificationMatrix({
  preferences,
  onToggle,
  disabled = false,
}: NotificationMatrixProps) {
  return (
    <div className={cn(disabled && "pointer-events-none opacity-60")}>
      {/* Header row */}
      <div className="flex items-center border-border/50 border-b py-2 pr-2 pl-1.5">
        <div className="flex-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Alert Type
        </div>
        <div className="flex items-center gap-1">
          <div className="w-14 text-center font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Web
          </div>
          <div className="w-14 text-center font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Email
          </div>
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {NOTIFICATION_CATEGORIES.map((category) => {
          const info = NOTIFICATION_CATEGORY_INFO[category];
          const Icon = info.icon;
          const pref = preferences[category];
          const anyEnabled = pref.inApp || pref.email;

          return (
            <div
              key={category}
              className="group flex items-center py-2.5 pr-2 pl-1"
            >
              {/* Category label with icon */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Icon
                  className={cn(
                    "mr-0.5 size-4 shrink-0 transition-colors",
                    anyEnabled
                      ? "text-foreground/70"
                      : "text-muted-foreground/50",
                  )}
                />
                <span
                  className={cn(
                    "truncate font-medium text-sm transition-colors",
                    anyEnabled ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {info.label}
                </span>
                <ResponsiveTooltip>
                  <ResponsiveTooltipTrigger
                    nativeButton={false}
                    render={
                      <span className="shrink-0 text-muted-foreground/80 opacity-0 transition-opacity group-hover:opacity-100">
                        <InfoIcon className="size-3.5" />
                      </span>
                    }
                  />
                  <ResponsiveTooltipContent className="max-w-xs">
                    {info.description}
                  </ResponsiveTooltipContent>
                </ResponsiveTooltip>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-1">
                <div className="flex w-14 items-center justify-center py-1">
                  <Checkbox
                    checked={pref.inApp}
                    onCheckedChange={(checked) =>
                      onToggle(category, "inApp", checked === true)
                    }
                    disabled={disabled}
                    aria-label={`Web notifications for ${info.label}`}
                  />
                </div>
                <div className="flex w-14 items-center justify-center py-1">
                  <Checkbox
                    checked={pref.email}
                    onCheckedChange={(checked) =>
                      onToggle(category, "email", checked === true)
                    }
                    disabled={disabled}
                    aria-label={`Email notifications for ${info.label}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
