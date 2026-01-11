import { InfoIcon } from "@phosphor-icons/react/ssr";
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
        "group flex flex-col gap-2 pt-2 pb-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-3 sm:pb-3",
        "border-border/40 border-b last:border-b-0",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {/* Icon + Label */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Icon indicator */}
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors sm:size-9",
            anyEnabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </div>

        {/* Label with info tooltip */}
        <div className="flex min-w-0 flex-1">
          <span>
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
                  <span className="px-[7px] text-foreground/70">
                    <InfoIcon className="inline-block size-3.5" />
                  </span>
                }
              />
              <ResponsiveTooltipContent className="max-w-sm">
                {info.description}
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>
          </span>
        </div>
      </div>

      {/* Switches */}
      <div className="flex w-full items-center justify-start gap-8 pl-12 sm:w-auto sm:justify-end sm:gap-6 sm:pl-0">
        {/* In-App Switch */}
        <div className="flex items-center gap-3 sm:w-16 sm:justify-center">
          <span className="text-muted-foreground text-xs sm:hidden">Web</span>
          <Switch
            checked={inAppEnabled}
            onCheckedChange={(v) => onToggle("inApp", v)}
            disabled={disabled}
            className="cursor-pointer"
            aria-label={`Toggle in-app notifications for ${info.label}`}
          />
        </div>

        {/* Email Switch */}
        <div className="flex items-center gap-3 sm:w-16 sm:justify-center">
          <span className="text-muted-foreground text-xs sm:hidden">Email</span>
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
