"use client";

import { LayoutGrid, Plus, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ViewMode } from "@/hooks/use-view-preference";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  userName: string;
  trackedCount: number;
  maxDomains: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddDomain: () => void;
};

export function DashboardHeader({
  userName,
  trackedCount,
  maxDomains,
  viewMode,
  onViewModeChange,
  onAddDomain,
}: DashboardHeaderProps) {
  const percentage = maxDomains > 0 ? (trackedCount / maxDomains) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}!
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <Progress value={percentage} className="w-24 sm:w-32" />
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {trackedCount}/{maxDomains}
          </span>
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-md border border-input dark:border-white/20">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            className={cn(
              "flex h-9 w-10 items-center justify-center rounded-l-[5px] border-r border-input transition-colors dark:border-white/20",
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-transparent",
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
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
        </div>

        <Button onClick={onAddDomain} disabled={trackedCount >= maxDomains}>
          <Plus className="size-4" />
          Add Domain
        </Button>
      </div>
    </div>
  );
}
