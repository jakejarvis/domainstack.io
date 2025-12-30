import { format } from "date-fns";
import { Gem, LayoutGrid, Plus, TableIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { UsageMeter } from "@/components/dashboard/usage-meter";
import { Button } from "@/components/ui/button";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ViewMode } from "@/hooks/use-dashboard-preferences";
import type { UserTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  userName: string;
  trackedCount: number;
  maxDomains: number;
  viewMode: ViewMode;
  tier: UserTier;
  /** When a canceled subscription ends (null = active subscription) */
  subscriptionEndsAt?: Date | null;
  onViewModeChange: (mode: ViewMode) => void;
  /** Whether the dashboard has any domains (active or archived) */
  hasAnyDomains?: boolean;
};

export function DashboardHeader({
  userName,
  trackedCount,
  maxDomains,
  viewMode,
  tier,
  subscriptionEndsAt,
  onViewModeChange,
  hasAnyDomains = false,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">
          Welcome back
          {userName ? `, ${userName.split(" ")[0]}` : ""}!
        </h1>
        {tier === "pro" ? (
          subscriptionEndsAt ? (
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
                Access until {format(subscriptionEndsAt, "MMM d, yyyy")}
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
            activeCount={trackedCount}
            maxDomains={maxDomains}
            className="w-24 bg-primary/12 md:w-32 dark:bg-primary/20"
          />
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {trackedCount}/{maxDomains}
          </span>
        </div>

        {/* View toggle and Add Domain - always right aligned */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* View toggle - only show when there are domains */}
          {hasAnyDomains && (
            <div className="relative inline-flex overflow-hidden rounded-md border border-muted-foreground/30">
              <motion.span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-0 z-0 w-10 bg-primary",
                  viewMode === "grid" ? "rounded-l-md" : "rounded-r-md",
                )}
                animate={{ x: viewMode === "grid" ? 0 : 40 }}
                transition={{ type: "spring", stiffness: 550, damping: 45 }}
                initial={false}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onViewModeChange("grid")}
                      aria-label="Grid view"
                      aria-pressed={viewMode === "grid"}
                      className={cn(
                        "relative z-10 flex h-9 w-10 items-center justify-center rounded-l-md border-input border-r bg-transparent transition-colors dark:border-white/20",
                        viewMode === "grid"
                          ? "text-primary-foreground"
                          : "cursor-pointer bg-background text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-transparent",
                      )}
                    >
                      <LayoutGrid className="size-4" />
                      <span className="sr-only">Grid view</span>
                    </button>
                  }
                />
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onViewModeChange("table")}
                      aria-label="Table view"
                      aria-pressed={viewMode === "table"}
                      className={cn(
                        "relative z-10 flex h-9 w-10 items-center justify-center rounded-r-md bg-transparent transition-colors",
                        viewMode === "table"
                          ? "text-primary-foreground"
                          : "cursor-pointer bg-background text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-transparent",
                      )}
                    >
                      <TableIcon className="size-4" />
                      <span className="sr-only">Table view</span>
                    </button>
                  }
                />
                <TooltipContent>Table view</TooltipContent>
              </Tooltip>
            </div>
          )}

          {trackedCount >= maxDomains ? (
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
                {tier === "free"
                  ? "Upgrade to add more domains"
                  : "Domain limit reached"}
              </ResponsiveTooltipContent>
            </ResponsiveTooltip>
          ) : (
            <Button
              nativeButton={false}
              render={
                <Link href="/dashboard/add-domain" scroll={false}>
                  <Plus />
                  Add Domain
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
