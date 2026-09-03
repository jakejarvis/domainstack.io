import { IconEye, IconTableOptions } from "@tabler/icons-react";

import { HIDEABLE_COLUMNS } from "@/components/dashboard/dashboard-table-columns";
import { useDashboardColumnVisibility, usePreferencesStore } from "@/lib/stores/preferences-store";
import { Button } from "@domainstack/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";

export function DashboardTableColumnMenu() {
  // Visibility is controlled by the preferences store, so this menu writes
  // there rather than calling `column.toggleVisibility()` on a table instance.
  const columnVisibility = useDashboardColumnVisibility();
  const setColumnVisibility = usePreferencesStore((s) => s.setColumnVisibility);

  // Missing keys default to visible — `{}` means show every column.
  const isColumnVisible = (columnId: string) => columnVisibility[columnId] ?? true;

  const hiddenCount = HIDEABLE_COLUMNS.filter((column) => !isColumnVisible(column.id)).length;

  const toggleColumn = (columnId: string) => {
    const currentlyVisible = isColumnVisible(columnId);
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !currentlyVisible,
    }));
  };

  const showAllColumns = () => {
    // Reset to empty object (all columns default to visible)
    setColumnVisibility({});
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <DropdownMenuTrigger
          render={
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
                  title={
                    hiddenCount > 0 ? `Toggle columns (${hiddenCount} hidden)` : "Toggle columns"
                  }
                >
                  <IconTableOptions className="text-foreground/90" />
                  <span className="sr-only">Toggle columns</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>
          {hiddenCount > 0 ? `Toggle columns (${hiddenCount} hidden)` : "Toggle columns"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="flex min-w-44 flex-col overflow-hidden p-0">
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-1">
            {HIDEABLE_COLUMNS.map((column) => {
              const isVisible = isColumnVisible(column.id);

              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={isVisible}
                  closeOnClick={false}
                  onClick={() => toggleColumn(column.id)}
                >
                  <span className="capitalize">{column.header}</span>
                </DropdownMenuCheckboxItem>
              );
            })}
            {hiddenCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={showAllColumns}
                  className="text-muted-foreground"
                >
                  <IconEye />
                  Show all columns
                </DropdownMenuItem>
              </>
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
