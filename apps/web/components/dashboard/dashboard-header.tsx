import { Button } from "@domainstack/ui/button";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { Separator } from "@domainstack/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@domainstack/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@domainstack/ui/tooltip";
import {
  IconExternalLink,
  IconGridDots,
  IconPlus,
  IconRocket,
  IconTable,
} from "@tabler/icons-react";
import { format } from "date-fns";
import Link from "next/link";
import { CalendarFeedPopover } from "@/components/dashboard/calendar-feed-popover";
import { QuotaBar } from "@/components/dashboard/quota-bar";
import { useSubscription } from "@/hooks/use-subscription";
import type { DashboardViewModeOptions } from "@/lib/dashboard-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";

type DashboardHeaderProps = {
  userName: string;
};

export function DashboardHeader({ userName }: DashboardHeaderProps) {
  const viewMode = usePreferencesStore((s) => s.viewMode);
  const setViewMode = usePreferencesStore((s) => s.setViewMode);
  const { subscription, handleCheckout } = useSubscription();

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 lg:flex lg:justify-between">
      {/* Welcome message */}
      <div className="flex items-center gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">
          Welcome back
          {userName ? `, ${userName.split(" ")[0]}` : ""}
        </h1>
        {subscription?.plan === "pro" ? (
          subscription?.endsAt ? (
            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                nativeButton={false}
                render={
                  <span className="inline-flex cursor-help select-none items-center gap-1 rounded-md border border-accent-gold/15 bg-gradient-to-r from-accent-gold/10 to-accent-gold/20 px-2 py-0.5 font-semibold text-[10px] text-accent-gold uppercase dark:border-accent-gold/20 dark:from-accent-gold/10 dark:to-accent-gold/15">
                    <IconRocket className="size-3" aria-hidden="true" />
                    Pro
                  </span>
                }
              />
              <ResponsiveTooltipContent>
                Access until {format(subscription.endsAt, "MMM d, yyyy")}
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>
          ) : (
            <span className="pointer-events-none inline-flex select-none items-center gap-1 rounded-md border border-accent-gold/15 bg-gradient-to-r from-accent-gold/10 to-accent-gold/20 px-2 py-0.5 font-semibold text-[10px] text-accent-gold uppercase dark:border-accent-gold/20 dark:from-accent-gold/10 dark:to-accent-gold/15">
              <IconRocket className="size-3" aria-hidden="true" />
              Pro
            </span>
          )
        ) : (
          <span className="pointer-events-none inline-flex select-none items-center rounded-md border border-foreground/30 px-2 py-0.5 font-medium text-[10px] text-foreground/70 uppercase">
            Free
          </span>
        )}
      </div>

      {/* Add Domain button - top-right on mobile, far right on desktop */}
      <div className="lg:order-last">
        {subscription?.canAddMore ? (
          <Button
            nativeButton={false}
            render={
              <Link href="/dashboard/add-domain" scroll={false}>
                <IconPlus />
                Add Domain
              </Link>
            }
          />
        ) : (
          <ResponsiveTooltip>
            <ResponsiveTooltipTrigger
              render={
                <Button disabled focusableWhenDisabled>
                  <IconPlus />
                  Add Domain
                </Button>
              }
            />
            <ResponsiveTooltipContent className="!p-0">
              {subscription?.plan === "free" ? (
                <Button
                  variant="link"
                  onClick={handleCheckout}
                  className="!px-2.5 !py-1.5 !h-auto gap-1 font-normal text-background text-xs"
                >
                  Upgrade to add more domains
                  <IconExternalLink className="size-3 -translate-y-[1px]" />
                </Button>
              ) : (
                "Domain limit reached"
              )}
            </ResponsiveTooltipContent>
          </ResponsiveTooltip>
        )}
      </div>

      {/* Bottom row on mobile: quota + view controls */}
      <div className="col-span-2 flex items-start justify-between gap-3 lg:col-auto lg:ml-auto lg:items-center lg:gap-4">
        {/* Progress indicator */}
        <div className="flex items-center gap-3 pr-1">
          {subscription && (
            <>
              <QuotaBar
                used={subscription.activeCount}
                planQuota={subscription.planQuota}
                className="w-24 bg-primary/12 md:w-32 dark:bg-primary/20"
              />
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {subscription.activeCount}/{subscription.planQuota}
              </span>
            </>
          )}
        </div>

        {/* View toggle and Calendar */}
        <div className="flex items-center gap-2.5">
          {/* View toggle - only show when there are domains */}
          {subscription?.activeCount && subscription.activeCount > 0 ? (
            <ToggleGroup
              multiple={false}
              value={[viewMode]}
              onValueChange={(groupValue) => {
                const next = groupValue[0] as
                  | DashboardViewModeOptions
                  | undefined;
                if (next) setViewMode(next);
              }}
              className="relative h-9 gap-0 overflow-hidden rounded-md border bg-transparent p-0 shadow-xs"
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      value="grid"
                      type="button"
                      variant="secondary"
                      aria-label="Grid view"
                      className="!px-3"
                    >
                      <IconGridDots className="size-4" />
                      <span className="sr-only">Grid</span>
                    </ToggleGroupItem>
                  }
                />
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      value="table"
                      type="button"
                      variant="secondary"
                      aria-label="Table view"
                      className="!px-3"
                    >
                      <IconTable className="size-4" />
                      <span className="sr-only">Table</span>
                    </ToggleGroupItem>
                  }
                />
                <TooltipContent>Table view</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          ) : null}

          {/* Calendar feed */}
          <CalendarFeedPopover />
        </div>
      </div>
    </div>
  );
}
