"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
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
} from "@/hooks/use-page-size-preference";

type TablePaginationProps = {
  pageIndex: number;
  pageSize: PageSize;
  pageCount: number;
  totalItems: number;
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
  totalItems,
  canPreviousPage,
  canNextPage,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const startItem = pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-4 border-black/15 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/15">
      {/* Results info */}
      <div className="text-muted-foreground text-sm">
        {totalItems > 0 ? (
          <>
            Showing{" "}
            <span className="font-medium text-foreground">{startItem}</span> to{" "}
            <span className="font-medium text-foreground">{endItem}</span> of{" "}
            <span className="font-medium text-foreground">{totalItems}</span>{" "}
            domains
          </>
        ) : (
          "No domains"
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) =>
              onPageSizeChange(Number(value) as PageSize)
            }
          >
            <SelectTrigger className="h-8 w-[70px]">
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
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          {/* First page */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(0)}
            disabled={!canPreviousPage}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="size-4" />
          </Button>

          {/* Previous page */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={!canPreviousPage}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>

          {/* Page indicator */}
          <span className="mx-2 min-w-[100px] text-center text-sm">
            Page{" "}
            <span className="font-medium">
              {pageCount > 0 ? pageIndex + 1 : 0}
            </span>{" "}
            of <span className="font-medium">{pageCount}</span>
          </span>

          {/* Next page */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canNextPage}
            aria-label="Go to next page"
          >
            <ChevronRight className="size-4" />
          </Button>

          {/* Last page */}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(pageCount - 1)}
            disabled={!canNextPage}
            aria-label="Go to last page"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
