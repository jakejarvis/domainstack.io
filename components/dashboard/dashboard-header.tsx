"use client";

import { format } from "date-fns";
import { Gem, LayoutGrid, Plus, TableIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ViewMode } from "@/hooks/use-view-preference";
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
  onAddDomain: () => void;
};

export function DashboardHeader({
  userName,
  trackedCount,
  maxDomains,
  viewMode,
  tier,
  subscriptionEndsAt,
  onViewModeChange,
  onAddDomain,
}: DashboardHeaderProps) {
  const percentage = maxDomains > 0 ? (trackedCount / maxDomains) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">
          Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}!
        </h1>
        {tier === "pro" ? (
          subscriptionEndsAt ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help select-none items-center gap-1 rounded-md border border-accent-gold/15 bg-gradient-to-r from-accent-gold/10 to-accent-gold/20 px-2 py-0.5 font-semibold text-[10px] text-accent-gold uppercase dark:border-accent-gold/20 dark:from-accent-gold/10 dark:to-accent-gold/15">
                  <Gem className="size-3" />
                  Pro
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Access until {format(subscriptionEndsAt, "MMM d, yyyy")}
              </TooltipContent>
            </Tooltip>
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <Progress value={percentage} className="w-24 md:w-32" />
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {trackedCount}/{maxDomains}
          </span>
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-md border border-input dark:border-white/20">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={cn(
                  "flex h-9 w-10 items-center justify-center rounded-l-[5px] border-input border-r transition-colors dark:border-white/20",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-transparent",
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Grid view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                aria-label="Table view"
                aria-pressed={viewMode === "table"}
                className={cn(
                  "flex h-9 w-10 items-center justify-center rounded-r-[5px] transition-colors",
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-transparent",
                )}
              >
                <TableIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Table view</TooltipContent>
          </Tooltip>
        </div>

        {trackedCount >= maxDomains ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button disabled className="pointer-events-none">
                  <Plus className="size-4" />
                  Add Domain
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {tier === "free"
                ? "Upgrade to Pro for more domains"
                : "Domain limit reached"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button asChild>
            <Link
              href="/dashboard/add-domain"
              data-disable-progress={true}
              onClick={(e) => {
                // Allow modifier clicks to open in new tab/window
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                  return;
                }
                e.preventDefault();
                onAddDomain();
              }}
            >
              <Plus className="size-4" />
              Add Domain
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
