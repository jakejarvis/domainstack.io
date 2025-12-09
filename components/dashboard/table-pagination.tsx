"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from "@/hooks/use-dashboard-preferences";

type TablePaginationProps = {
  pageIndex: number;
  pageSize: PageSize;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
};

/**
 * Pagination controls for the domains table.
 * Includes page navigation and page size selector.
 */
export function TablePagination({
  pageIndex,
  pageSize,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  return (
    <div className="flex h-12 items-center justify-between border-black/10 border-t px-4 py-2 dark:border-white/10">
      {/* Page size selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">Show</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
        >
          <SelectTrigger className="!h-8 gap-1.5 px-2 text-xs">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-xs">domains per page</span>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        {/* Page indicator */}
        <span className="mr-2 text-muted-foreground text-xs">
          {pageCount > 0 ? pageIndex + 1 : 0} of {pageCount}
        </span>

        {/* Previous page */}
        <Button
          variant="outline"
          size="icon-sm"
          className="size-6"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={!canPreviousPage}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="size-3" />
        </Button>

        {/* Next page */}
        <Button
          variant="outline"
          size="icon-sm"
          className="size-6"
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={!canNextPage}
          aria-label="Go to next page"
        >
          <ChevronRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}
