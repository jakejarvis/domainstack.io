import { IconChevronDown, IconFilter } from "@tabler/icons-react";
import { useState } from "react";

import { DashboardTableColumnMenu } from "@/components/dashboard/dashboard-table-column-menu";
import { useDashboardViewMode } from "@/lib/stores/preferences-store";
import { Badge } from "@domainstack/ui/badge";
import { Button } from "@domainstack/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@domainstack/ui/collapsible";
import { cn } from "@domainstack/ui/utils";

type MobileFiltersCollapsibleProps = {
  hasActiveFilters: boolean;
  activeFilterCount: number;
  children: React.ReactNode;
};

export function MobileFiltersCollapsible({
  hasActiveFilters,
  activeFilterCount,
  children,
}: MobileFiltersCollapsibleProps) {
  const viewMode = useDashboardViewMode();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Collapsible open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger
          render={
            <Button variant="outline" className="flex-1 justify-between">
              <span className="flex items-center gap-2">
                <IconFilter className="text-muted-foreground" />
                <span className="text-sm">Filters</span>
                {hasActiveFilters && (
                  <Badge
                    variant="secondary"
                    className="ml-1 animate-in duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] fade-in-0 zoom-in-90 motion-reduce:animate-none"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </span>
              <IconChevronDown className={cn("transition-transform", mobileOpen && "rotate-180")} />
            </Button>
          }
        />

        {/* Column visibility - always visible in collapsed mode for table view */}
        {viewMode === "table" && <DashboardTableColumnMenu />}
      </div>

      <CollapsibleContent keepMounted>
        <div className="pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
