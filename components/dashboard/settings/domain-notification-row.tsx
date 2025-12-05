"use client";

import { RotateCcw } from "lucide-react";
import { ThreeStateCheckbox } from "@/components/dashboard/settings/three-state-checkbox";
import { Favicon } from "@/components/domain/favicon";
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
 * Shows both mobile and desktop layouts.
 */
export function DomainNotificationRow({
  domainName,
  overrides,
  globalPrefs,
  onToggle,
  onReset,
  disabled,
}: DomainNotificationRowProps) {
  const hasOverrides = Object.values(overrides ?? {}).some(
    (v) => v !== undefined,
  );

  // Mobile view
  const mobileView = (
    <div className="space-y-4 rounded-lg border p-4 sm:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Favicon domain={domainName} size={20} />
          <span className="font-medium text-sm">{domainName}</span>
        </div>
        {hasOverrides && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground text-xs"
            onClick={onReset}
            disabled={disabled}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
        )}
      </div>
      <div className="grid gap-3">
        {NOTIFICATION_CATEGORIES.map((category) => {
          const override = overrides[category];
          const globalValue = globalPrefs[category];
          const isInherited = override === undefined;

          return (
            <div
              key={category}
              className="flex items-center justify-between text-sm"
            >
              <span className={cn(isInherited && "text-muted-foreground")}>
                {NOTIFICATION_CATEGORY_INFO[category].label}
                {isInherited && " (default)"}
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
    <div className="hidden items-center gap-2 rounded-lg border p-4 sm:grid sm:grid-cols-[1fr_repeat(3,80px)_40px]">
      <div className="flex min-w-0 items-center gap-2">
        <Favicon domain={domainName} size={20} />
        <span className="truncate font-medium text-sm">{domainName}</span>
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
        {hasOverrides && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onReset}
                disabled={disabled}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to defaults</TooltipContent>
          </Tooltip>
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
