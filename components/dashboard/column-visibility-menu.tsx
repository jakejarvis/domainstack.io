"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronDown, Columns3Cog, Eye } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColumnVisibilityPreference } from "@/hooks/use-dashboard-preferences";
import { useScrollIndicators } from "@/hooks/use-scroll-indicators";
import { cn } from "@/lib/utils";

type ColumnVisibilityMenuProps<TData> = {
  table: Table<TData>;
};

function ScrollableMenuContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { showStart, showEnd, update } = useScrollIndicators({
    containerRef: scrollRef,
    direction: "vertical",
  });

  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [update]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Top scroll shadow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-black/15 to-transparent transition-opacity duration-200 dark:from-black/40",
          showStart ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={cn("min-h-0 flex-1 overflow-y-auto p-1", className)}
      >
        <div ref={contentRef}>{children}</div>
      </div>

      {/* Bottom scroll indicator with shadow and chevron */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center transition-opacity duration-200",
          showEnd ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      >
        {/* Gradient shadow */}
        <div className="h-8 w-full bg-gradient-to-t from-black/20 to-transparent dark:from-black/50" />
        {/* Chevron indicator */}
        <div className="absolute bottom-1 flex items-center justify-center">
          <ChevronDown className="size-4 animate-bounce text-muted-foreground/90" />
        </div>
      </div>
    </div>
  );
}

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
        <ScrollableMenuContent>
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
                <Checkbox checked={isVisible} className="pointer-events-none" />
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
        </ScrollableMenuContent>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
