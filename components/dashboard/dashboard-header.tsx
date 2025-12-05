"use client";

import { ArrowUpDown, Check, LayoutGrid, Plus, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SORT_OPTIONS, type SortOption } from "@/hooks/use-sort-preference";
import type { ViewMode } from "@/hooks/use-view-preference";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  userName: string;
  trackedCount: number;
  maxDomains: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddDomain: () => void;
  sortOption?: SortOption;
  onSortChange?: (sort: SortOption) => void;
};

export function DashboardHeader({
  userName,
  trackedCount,
  maxDomains,
  viewMode,
  onViewModeChange,
  onAddDomain,
  sortOption,
  onSortChange,
}: DashboardHeaderProps) {
  const percentage = maxDomains > 0 ? (trackedCount / maxDomains) * 100 : 0;
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortOption)?.shortLabel ?? "Sort";

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

        {/* Sort dropdown - only for grid view */}
        {viewMode === "grid" && sortOption && onSortChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowUpDown className="size-3.5" />
                <span className="hidden sm:inline">{currentSortLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      "size-4",
                      sortOption === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* View toggle */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => {
            if (value) onViewModeChange(value as ViewMode);
          }}
          variant="outline"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <TableIcon className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <Button onClick={onAddDomain} disabled={trackedCount >= maxDomains}>
          <Plus className="size-4" />
          Add Domain
        </Button>
      </div>
    </div>
  );
}
