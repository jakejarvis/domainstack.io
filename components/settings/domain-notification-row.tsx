import { ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Favicon } from "@/components/icons/favicon";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Badge } from "../ui/badge";

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
  const [isOpen, setIsOpen] = useState(false);
  const activeOverridesCount = Object.values(overrides).filter(
    (v) => v !== undefined,
  ).length;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        "rounded-xl border border-border/40 bg-muted/20 transition-all",
        isOpen ? "pb-2" : "",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2 pr-2">
        <CollapsibleTrigger className="group flex h-11 flex-1 cursor-pointer items-center justify-between gap-4 pr-1.5 pl-4 text-left">
          <div className="flex flex-1 items-center justify-between gap-4">
            <div className="flex w-full items-center justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Favicon domain={domainName} size={16} />
                <span className="truncate font-semibold text-foreground text-sm">
                  {domainName}
                </span>
                {activeOverridesCount > 0 && (
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-0.5 font-medium text-[10px] text-foreground leading-tight"
                  >
                    {activeOverridesCount}
                    <span className="sr-only sm:not-sr-only">
                      override{activeOverridesCount !== 1 && "s"}
                    </span>
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeOverridesCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 px-2 text-foreground text-xs hover:bg-muted/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReset();
                    }}
                    disabled={disabled}
                  >
                    <RotateCcw className="size-3" />
                    <span className="sr-only sm:not-sr-only">Reset</span>
                  </Button>
                )}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "-rotate-180",
                  )}
                />
              </div>
            </div>
          </div>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="space-y-1 px-1 pb-1">
          {/* Desktop Headers */}
          <div className="hidden items-center justify-end gap-6 px-2 pb-1 font-medium text-foreground/75 text-xs sm:flex">
            <div className="w-16 text-center">Web</div>
            <div className="w-16 text-center">Email</div>
          </div>

          {NOTIFICATION_CATEGORIES.map((category) => {
            const info = NOTIFICATION_CATEGORY_INFO[category];
            const Icon = info.icon;

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
                className="flex flex-col gap-2 rounded-lg py-2 pr-2 pl-3 text-sm transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-0"
              >
                <span className="mb-1 flex items-center gap-2 font-medium text-[13px] text-foreground/90 sm:mb-0">
                  <Icon className="size-3" />
                  {info.label}
                </span>

                <div className="flex items-center justify-start gap-8 pl-5 sm:justify-end sm:gap-6 sm:pl-0">
                  {/* In-App Switch */}
                  <div className="flex items-center gap-3 sm:w-16 sm:justify-center sm:gap-2">
                    <span className="font-medium text-foreground/70 text-xs sm:hidden">
                      Web
                    </span>
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
                  <div className="flex items-center gap-3 sm:w-16 sm:justify-center sm:gap-2">
                    <span className="font-medium text-foreground/70 text-xs sm:hidden">
                      Email
                    </span>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
