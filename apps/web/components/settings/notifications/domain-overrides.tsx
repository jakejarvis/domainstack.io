"use client";

import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  GlobeIcon,
} from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { Favicon } from "@/components/icons/favicon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { NOTIFICATION_CATEGORY_INFO } from "@/lib/constants/notification-ui";
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/constants/notifications";
import type {
  NotificationOverrides,
  UserNotificationPreferences,
} from "@/lib/types/notifications";
import { cn } from "@/lib/utils";

interface DomainOverride {
  id: string;
  domainName: string;
  overrides: NotificationOverrides;
}

interface DomainOverridesProps {
  domains: DomainOverride[];
  globalPrefs: UserNotificationPreferences;
  onToggle: (
    domainId: string,
    category: NotificationCategory,
    type: "email" | "inApp",
    value: boolean,
  ) => void;
  onReset: (domainId: string) => void;
  disabled?: boolean;
}

/**
 * Compact domain overrides list.
 * Each domain expands to show a mini notification matrix.
 */
export function DomainOverrides({
  domains,
  globalPrefs,
  onToggle,
  onReset,
  disabled = false,
}: DomainOverridesProps) {
  if (domains.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/50 border-dashed bg-muted/10 px-4 py-6">
        <GlobeIcon className="size-5 text-muted-foreground/50" />
        <p className="text-muted-foreground text-sm">
          Verify domains to customize their notification settings individually.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-2", disabled && "pointer-events-none opacity-60")}
    >
      {domains.map((domain) => (
        <DomainOverrideRow
          key={domain.id}
          domain={domain}
          globalPrefs={globalPrefs}
          onToggle={(category, type, value) =>
            onToggle(domain.id, category, type, value)
          }
          onReset={() => onReset(domain.id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

interface DomainOverrideRowProps {
  domain: DomainOverride;
  globalPrefs: UserNotificationPreferences;
  onToggle: (
    category: NotificationCategory,
    type: "email" | "inApp",
    value: boolean,
  ) => void;
  onReset: () => void;
  disabled?: boolean;
}

function DomainOverrideRow({
  domain,
  globalPrefs,
  onToggle,
  onReset,
  disabled = false,
}: DomainOverrideRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const overrideCount = Object.values(domain.overrides).filter(
    (v) => v !== undefined,
  ).length;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="rounded-xl border border-border/50 bg-muted/20 transition-colors data-[state=open]:bg-muted/30"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left">
        <Favicon domain={domain.domainName} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium text-sm">
          {domain.domainName}
        </span>

        {overrideCount > 0 && (
          <Badge
            variant="secondary"
            className="shrink-0 gap-1 px-1.5 py-0.5 font-medium text-[10px]"
          >
            {overrideCount}
          </Badge>
        )}

        <CaretDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-border/30 border-t px-4 pt-3 pb-4">
          {/* Mini matrix header */}
          <div className="mb-2 flex items-center">
            <div className="flex-1 text-muted-foreground text-xs" />
            <div className="flex items-center gap-1">
              <div className="w-12 text-center text-[10px] text-muted-foreground uppercase tracking-wide">
                Web
              </div>
              <div className="w-12 text-center text-[10px] text-muted-foreground uppercase tracking-wide">
                Email
              </div>
            </div>
          </div>

          {/* Category rows */}
          <div className="space-y-1">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const info = NOTIFICATION_CATEGORY_INFO[category];
              const override = domain.overrides[category];
              const globalPref = globalPrefs[category];

              // Effective values (override or inherited)
              const inAppValue = override?.inApp ?? globalPref.inApp;
              const emailValue = override?.email ?? globalPref.email;

              // Is this category customized?
              const isCustomized = override !== undefined;

              return (
                <div
                  key={category}
                  className={cn(
                    "flex items-center rounded-lg py-1.5 transition-colors",
                    isCustomized && "bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex-1 text-[13px]",
                      isCustomized
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {info.label}
                  </span>

                  <div className="flex items-center gap-1">
                    <div className="flex w-12 items-center justify-center">
                      <Checkbox
                        checked={inAppValue}
                        onCheckedChange={(checked) =>
                          onToggle(category, "inApp", checked === true)
                        }
                        disabled={disabled}
                        className={cn(!isCustomized && "opacity-50")}
                        aria-label={`Web notifications for ${info.label} on ${domain.domainName}`}
                      />
                    </div>
                    <div className="flex w-12 items-center justify-center">
                      <Checkbox
                        checked={emailValue}
                        onCheckedChange={(checked) =>
                          onToggle(category, "email", checked === true)
                        }
                        disabled={disabled}
                        className={cn(!isCustomized && "opacity-50")}
                        aria-label={`Email notifications for ${info.label} on ${domain.domainName}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reset button */}
          {overrideCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 h-8 w-full gap-1.5 text-muted-foreground text-xs hover:text-foreground"
              onClick={onReset}
              disabled={disabled}
            >
              <ArrowCounterClockwiseIcon className="size-3.5" />
              Reset to global defaults
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
