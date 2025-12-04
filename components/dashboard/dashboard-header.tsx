"use client";

import { LayoutGrid, Plus, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ViewMode } from "@/hooks/use-view-preference";

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
          Welcome back, {userName.split(" ")[0]}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Progress value={percentage} className="w-24 sm:w-32" />
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {trackedCount}/{maxDomains}
          </span>
        </div>

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
