import { format } from "date-fns";
import { Gem, LayoutGrid, Plus, TableIcon } from "lucide-react";
import Link from "next/link";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { Button } from "@/components/ui/button";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ViewMode } from "@/hooks/use-dashboard-preferences";
import type { Subscription } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  userName: string;
  subscription?: Subscription;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

export function DashboardHeader({
  userName,
  subscription,
  viewMode,
  onViewModeChange,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">
          Welcome back
          {userName ? `, ${userName.split(" ")[0]}` : ""}!
        </h1>
        {subscription?.plan === "pro" ? (
          subscription?.endsAt ? (
            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                nativeButton={false}
                render={
                  <span className="inline-flex cursor-help select-none items-center gap-1 rounded-md border border-accent-gold/15 bg-gradient-to-r from-accent-gold/10 to-accent-gold/20 px-2 py-0.5 font-semibold text-[10px] text-accent-gold uppercase dark:border-accent-gold/20 dark:from-accent-gold/10 dark:to-accent-gold/15">
                    <Gem className="size-3" />
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
              <Gem className="size-3" />
              Pro
            </span>
          )
        ) : (
          <span className="pointer-events-none inline-flex select-none items-center rounded-md border border-foreground/30 px-2 py-0.5 font-medium text-[10px] text-foreground/70 uppercase">
            Free
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        {/* Progress indicator */}
        <div className="flex items-center gap-3 pr-1">
          <UsageMeter
            activeCount={subscription?.activeCount}
            planQuota={subscription?.planQuota}
            className="w-24 bg-primary/12 md:w-32 dark:bg-primary/20"
          />
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {subscription?.activeCount}/{subscription?.planQuota}
          </span>
        </div>

        {/* View toggle and Add Domain - always right aligned */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* View toggle - only show when there are domains */}
          {subscription?.activeCount && subscription.activeCount > 0 ? (
            <ToggleGroup
              multiple={false}
              value={[viewMode]}
              onValueChange={(groupValue) => {
                const next = groupValue[0] as ViewMode | undefined;
                if (next) onViewModeChange(next);
              }}
              className="relative inline-flex h-9 gap-0 overflow-hidden rounded-md border border-muted-foreground/30 bg-background p-0"
            >
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-0 z-0 w-10 bg-primary",
                  viewMode === "grid" ? "translate-x-0" : "translate-x-10",
                )}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      value="grid"
                      type="button"
                      aria-label="Grid view"
                      variant="ghost"
                      className={cn(
                        "relative z-10 h-9 w-10 cursor-pointer rounded-l-md border-input border-r bg-transparent px-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-white/20",
                        "data-[pressed]:rounded-l-md data-[pressed]:bg-transparent data-[pressed]:text-primary-foreground data-[pressed]:shadow-none data-[pressed]:ring-0",
                      )}
                    >
                      <LayoutGrid className="size-4" />
                      <span className="sr-only">Grid view</span>
                    </ToggleGroupItem>
                  }
                />
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <ToggleGroupItem
                      value="table"
                      type="button"
                      aria-label="Table view"
                      variant="ghost"
                      className={cn(
                        "relative z-10 h-9 w-10 cursor-pointer rounded-r-md bg-transparent px-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        "data-[pressed]:rounded-r-md data-[pressed]:bg-transparent data-[pressed]:text-primary-foreground data-[pressed]:shadow-none data-[pressed]:ring-0",
                      )}
                    >
                      <TableIcon className="size-4" />
                      <span className="sr-only">Table view</span>
                    </ToggleGroupItem>
                  }
                />
                <TooltipContent>Table view</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          ) : null}

          {subscription?.canAddMore ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/dashboard/add-domain" scroll={false}>
                  <Plus />
                  Add Domain
                </Link>
              }
            />
          ) : (
            <ResponsiveTooltip>
              <ResponsiveTooltipTrigger
                render={
                  <div className="cursor-not-allowed">
                    <Button disabled>
                      <Plus />
                      Add Domain
                    </Button>
                  </div>
                }
              />
              <ResponsiveTooltipContent>
                {subscription?.plan === "free"
                  ? "Upgrade to add more domains"
                  : "Domain limit reached"}
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>
          )}
        </div>
      </div>
    </div>
  );
}
