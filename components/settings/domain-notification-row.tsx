"use client";

import { RotateCcw } from "lucide-react";
import { Favicon } from "@/components/domain/favicon";
import { ThreeStateCheckbox } from "@/components/settings/three-state-checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_INFO,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import type { NotificationOverrides } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface DomainNotificationRowProps {
  domainName: string;
  overrides: NotificationOverrides;
  globalPrefs: {
    domainExpiry: boolean;
    certificateExpiry: boolean;
    verificationStatus: boolean;
  };
  onToggle: (
    category: NotificationCategory,
    value: boolean | undefined,
  ) => void;
  onReset: () => void;
  disabled: boolean;
}

/**
 * A row for managing per-domain notification overrides.
 * Clean design with subtle hover states matching the global row aesthetic.
 */
export function DomainNotificationRow({
  domainName,
  overrides,
  globalPrefs,
  onToggle,
  onReset,
  disabled,
}: DomainNotificationRowProps) {
  const hasOverrides = Object.values(overrides).some((v) => v !== undefined);

  // Mobile view
  const mobileView = (
    <div
      className={cn(
        "rounded-xl border border-black/10 bg-muted/20 p-3 sm:hidden dark:border-white/10",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Favicon domain={domainName} size={18} />
          <span className="font-medium text-sm">{domainName}</span>
        </div>
        {hasOverrides && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground"
            onClick={onReset}
            disabled={disabled}
          >
            <RotateCcw className="size-3" />
            Reset
          </Button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {NOTIFICATION_CATEGORIES.map((category) => {
          const override = overrides[category];
          const globalValue = globalPrefs[category];
          const isInherited = override === undefined;

          return (
            <div
              key={category}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
            >
              <span
                className={cn(
                  "text-xs",
                  isInherited ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {NOTIFICATION_CATEGORY_INFO[category].label}
                {isInherited && (
                  <span className="ml-1 text-muted-foreground/60">
                    (default)
                  </span>
                )}
              </span>
              <ThreeStateCheckbox
                value={override}
                globalValue={globalValue}
                onChange={(value) => onToggle(category, value)}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  // Desktop view
  const desktopView = (
    <div
      className={cn(
        "group hidden items-center gap-2 rounded-xl border border-black/10 bg-muted/20 px-3 py-2.5 transition-colors sm:grid sm:grid-cols-[1fr_repeat(3,72px)_36px] dark:border-white/10",
        !disabled && "hover:bg-muted/40",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Favicon domain={domainName} size={18} />
        <span className="truncate text-sm">{domainName}</span>
      </div>
      {NOTIFICATION_CATEGORIES.map((category) => {
        const override = overrides[category];
        const globalValue = globalPrefs[category];

        return (
          <div key={category} className="flex justify-center">
            <ThreeStateCheckbox
              value={override}
              globalValue={globalValue}
              onChange={(value) => onToggle(category, value)}
              disabled={disabled}
            />
          </div>
        );
      })}
      <div className="flex justify-center">
        {hasOverrides ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={onReset}
                disabled={disabled}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to defaults</TooltipContent>
          </Tooltip>
        ) : (
          <div className="size-7" /> // Spacer to maintain grid alignment
        )}
      </div>
    </div>
  );

  return (
    <>
      {mobileView}
      {desktopView}
    </>
  );
}
