"use client";

import type { Table } from "@tanstack/react-table";
import { Columns3Cog, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useColumnVisibilityPreference } from "@/hooks/use-dashboard-preferences";

type ColumnVisibilityMenuProps<TData> = {
  table: Table<TData>;
};

export function ColumnVisibilityMenu<TData>({
  table,
}: ColumnVisibilityMenuProps<TData>) {
  // Read visibility state directly from localStorage hook (not stale table API)
  const [columnVisibility, setColumnVisibility] =
    useColumnVisibilityPreference();

  const allColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide());

  // Check visibility from our state, not the table API
  const isColumnVisible = (columnId: string) => {
    return columnVisibility[columnId] !== false;
  };

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
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-9 cursor-pointer"
            title={
              hiddenCount > 0
                ? `Toggle columns (${hiddenCount} hidden)`
                : "Toggle columns"
            }
          >
            <Columns3Cog className="size-4" />
            <span className="sr-only">Toggle columns</span>
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="flex w-48 flex-col overflow-hidden p-0"
      >
        <ScrollArea
          className="h-auto min-h-0 flex-1"
          gradient
          gradientContext="popover"
        >
          <div className="p-1">
            {allColumns.map((column) => {
              const columnDef = column.columnDef;
              const header =
                typeof columnDef.header === "string"
                  ? columnDef.header
                  : column.id;
              const isVisible = isColumnVisible(column.id);

              return (
                <DropdownMenuItem
                  key={column.id}
                  closeOnClick={false}
                  onClick={() => toggleColumn(column.id)}
                  className="cursor-pointer"
                >
                  <Checkbox
                    checked={isVisible}
                    className="pointer-events-none"
                  />
                  <span className="capitalize">{header}</span>
                </DropdownMenuItem>
              );
            })}
            {hiddenCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  closeOnClick={false}
                  onClick={showAllColumns}
                  className="cursor-pointer text-muted-foreground"
                >
                  <Eye className="size-4" />
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
