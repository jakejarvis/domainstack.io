"use client";

import { RotateCcw } from "lucide-react";
import { Favicon } from "@/components/domain/favicon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_INFO,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import type {
  NotificationOverrides,
  UserNotificationPreferences,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface DomainNotificationRowProps {
  domainName: string;
  overrides: NotificationOverrides;
  globalPrefs: UserNotificationPreferences;
  onToggle: (
    category: NotificationCategory,
    type: "email" | "inApp",
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

  return (
    <div
      className={cn(
        "rounded-xl border border-black/10 bg-muted/20 p-3 dark:border-white/10",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-7 items-center gap-2">
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
          // Get override and global preference objects
          const override = overrides[category];
          const globalPref = globalPrefs[category];

          // Determine effective values
          const emailEffective = override?.email ?? globalPref.email;
          const inAppEffective = override?.inApp ?? globalPref.inApp;

          // Check if inherited
          const emailIsInherited =
            override === undefined || override.email === undefined;
          const inAppIsInherited =
            override === undefined || override.inApp === undefined;

          return (
            <div
              key={category}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
            >
              <span
                className={cn(
                  "text-xs",
                  emailIsInherited && inAppIsInherited
                    ? "text-muted-foreground"
                    : "text-foreground",
                )}
              >
                {NOTIFICATION_CATEGORY_INFO[category].label}
              </span>

              <div className="flex items-center gap-2 sm:gap-6">
                {/* In-App Switch */}
                <div className="flex w-12 items-center justify-center gap-2 sm:w-16">
                  {!inAppIsInherited && (
                    <span className="sr-only">Override</span>
                  )}
                  <Switch
                    checked={inAppEffective}
                    onCheckedChange={(checked) => {
                      onToggle(
                        category,
                        "inApp",
                        checked === globalPref.inApp ? undefined : checked,
                      );
                    }}
                    disabled={disabled}
                    className={cn(
                      "cursor-pointer",
                      inAppIsInherited && "opacity-60",
                    )}
                    aria-label={`Toggle in-app notifications for ${category}`}
                  />
                </div>

                {/* Email Switch */}
                <div className="flex w-12 items-center justify-center gap-2 sm:w-16">
                  {!emailIsInherited && (
                    <span className="sr-only">Override</span>
                  )}
                  <Switch
                    checked={emailEffective}
                    onCheckedChange={(checked) => {
                      onToggle(
                        category,
                        "email",
                        checked === globalPref.email ? undefined : checked,
                      );
                    }}
                    disabled={disabled}
                    className={cn(
                      "cursor-pointer",
                      emailIsInherited && "opacity-60",
                    )}
                    aria-label={`Toggle email notifications for ${category}`}
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
