"use client";

import type { Table } from "@tanstack/react-table";
import { Columns3Cog, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="size-9">
              <Columns3Cog className="size-4" />
              <span className="sr-only">Toggle columns</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {hiddenCount > 0
            ? `Toggle columns (${hiddenCount} hidden)`
            : "Toggle columns"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        {allColumns.map((column) => {
          const columnDef = column.columnDef;
          const header =
            typeof columnDef.header === "string" ? columnDef.header : column.id;
          const isVisible = isColumnVisible(column.id);

          return (
            <DropdownMenuItem
              key={column.id}
              onSelect={(e) => {
                e.preventDefault();
                toggleColumn(column.id);
              }}
            >
              <Checkbox checked={isVisible} className="pointer-events-none" />
              <span className="capitalize">{header}</span>
            </DropdownMenuItem>
          );
        })}
        {hiddenCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                showAllColumns();
              }}
              className="text-muted-foreground"
            >
              <RefreshCcw className="size-4" />
              Show all columns
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
