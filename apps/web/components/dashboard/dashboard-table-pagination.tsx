import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DASHBOARD_PAGE_SIZE_OPTIONS,
  type DashboardPageSizeOptions,
} from "@/lib/dashboard-utils";

type DashboardTablePaginationProps = {
  pageIndex: number;
  pageSize: DashboardPageSizeOptions;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: DashboardPageSizeOptions) => void;
};

/**
 * Pagination controls for the domains table.
 * Includes page navigation and page size selector.
 */
export function DashboardTablePagination({
  pageIndex,
  pageSize,
  pageCount,
  canPreviousPage,
  canNextPage,
  onPageChange,
  onPageSizeChange,
}: DashboardTablePaginationProps) {
  return (
    <div className="flex h-12 items-center justify-between border-black/10 border-t px-4 py-2 dark:border-white/10">
      {/* Page size selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-xs">Show</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) =>
            onPageSizeChange(Number(value) as DashboardPageSizeOptions)
          }
        >
          <SelectTrigger className="!h-8 cursor-pointer gap-1.5 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DASHBOARD_PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem
                key={size}
                value={String(size)}
                className="cursor-pointer text-[13px]"
              >
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-xs">domains per page</span>
      </div>

      {/* Page navigation */}
      <Pagination className="mx-0 w-auto">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <span className="mr-2 text-muted-foreground text-xs">
              {pageCount > 0 ? pageIndex + 1 : 0} of {pageCount}
            </span>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={!canPreviousPage}
              aria-label="Go to previous page"
            >
              <IconChevronLeft />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={!canNextPage}
              aria-label="Go to next page"
            >
              <IconChevronRight />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
