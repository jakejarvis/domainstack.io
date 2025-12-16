"use client";

import { RotateCcw } from "lucide-react";
import { Favicon } from "@/components/domain/favicon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
 * Switches show the effective state (inherited or overridden):
 * - Regular opacity: Inheriting from global settings
 * - Reduced opacity + "Override" label: Explicitly overridden
 * - Clicking a switch sets an override; clicking to match global clears it
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
            className="h-7 cursor-pointer px-2 text-muted-foreground text-xs hover:text-foreground"
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
          const effectiveValue = override ?? globalValue;

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
              </span>
              <div className="flex items-center gap-2">
                {!isInherited && (
                  <span className="text-[10px] text-muted-foreground">
                    Override
                  </span>
                )}
                <Switch
                  checked={effectiveValue}
                  onCheckedChange={(checked) => {
                    // If clicking would make it match global, clear override (inherit)
                    // Otherwise, set explicit override
                    onToggle(
                      category,
                      checked === globalValue ? undefined : checked,
                    );
                  }}
                  disabled={disabled}
                  className={cn("cursor-pointer", isInherited && "opacity-60")}
                />
              </div>
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
        const isInherited = override === undefined;
        const effectiveValue = override ?? globalValue;

        return (
          <div key={category} className="flex justify-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Switch
                    checked={effectiveValue}
                    onCheckedChange={(checked) => {
                      // If clicking would make it match global, clear override (inherit)
                      // Otherwise, set explicit override
                      onToggle(
                        category,
                        checked === globalValue ? undefined : checked,
                      );
                    }}
                    disabled={disabled}
                    className={cn(
                      "cursor-pointer",
                      isInherited && "opacity-60",
                    )}
                  />
                }
              />
              <TooltipContent>
                {isInherited
                  ? `Inheriting (${effectiveValue ? "enabled" : "disabled"})`
                  : `Override: ${effectiveValue ? "enabled" : "disabled"}`}
              </TooltipContent>
            </Tooltip>
          </div>
        );
      })}
      {hasOverrides ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={onReset}
                disabled={disabled}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Reset to defaults</TooltipContent>
        </Tooltip>
      ) : (
        <div className="size-7" /> // Spacer to maintain grid alignment
      )}
    </div>
  );

  return (
    <>
      {mobileView}
      {desktopView}
    </>
  );
}
