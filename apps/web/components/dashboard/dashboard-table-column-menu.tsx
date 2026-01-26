import { IconEye, IconTableOptions } from "@tabler/icons-react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";

type DashboardTableColumnMenuProps<TData> = {
  table: Table<TData>;
};

export function DashboardTableColumnMenu<TData>({
  table,
}: DashboardTableColumnMenuProps<TData>) {
  // Read visibility state directly from localStorage hook (not stale table API)
  const { columnVisibility, setColumnVisibility } = useDashboardPreferences();

  const allColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide());

  // Check visibility from our state, not the table API
  const isColumnVisible = (columnId: string) =>
    columnVisibility[columnId] !== false;

  const hiddenCount = allColumns.filter(
    (column) => !isColumnVisible(column.id),
  ).length;

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
                    hiddenCount > 0
                      ? `Toggle columns (${hiddenCount} hidden)`
                      : "Toggle columns"
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
          {hiddenCount > 0
            ? `Toggle columns (${hiddenCount} hidden)`
            : "Toggle columns"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="flex min-w-44 flex-col overflow-hidden p-0"
      >
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-1">
            {allColumns.map((column) => {
              const { columnDef } = column;
              const header =
                typeof columnDef.header === "string"
                  ? columnDef.header
                  : column.id;
              const isVisible = isColumnVisible(column.id);

              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={isVisible}
                  closeOnClick={false}
                  onClick={() => toggleColumn(column.id)}
                >
                  <span className="capitalize">{header}</span>
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
