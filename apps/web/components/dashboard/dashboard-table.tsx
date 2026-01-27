"use no memo"; // Disable React Compiler memoization - TanStack Table has issues with it
// See: https://github.com/TanStack/table/issues/5567

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  createColumns,
  createUnverifiedLastSorter,
} from "@/components/dashboard/dashboard-table-columns";
import { DashboardTablePagination } from "@/components/dashboard/dashboard-table-pagination";
import { SortIndicator } from "@/components/dashboard/sort-indicator";
import { UnverifiedTableRow } from "@/components/dashboard/unverified-table-row";
import { UpgradeRow } from "@/components/dashboard/upgrade-row";
import { VerifiedTableRow } from "@/components/dashboard/verified-table-row";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardPagination } from "@/hooks/use-dashboard-pagination";
import { useDashboardTableSort } from "@/hooks/use-dashboard-sort";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";
import { cn } from "@/lib/utils";

type DashboardTableProps = {
  domains: TrackedDomainWithDetails[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onVerify: (domain: TrackedDomainWithDetails) => void;
  onRemove: (id: string, domainName: string) => void;
  onArchive: (id: string, domainName: string) => void;
  onToggleMuted: (id: string, muted: boolean) => void;
  onTableReady?: (
    table: ReturnType<typeof useReactTable<TrackedDomainWithDetails>>,
  ) => void;
};

const EMPTY_SET = new Set<string>();

export function DashboardTable({
  domains,
  selectedIds = EMPTY_SET,
  onToggleSelect,
  onVerify,
  onRemove,
  onArchive,
  onToggleMuted,
  onTableReady,
}: DashboardTableProps) {
  const { pagination, pageSize, setPageSize, setPageIndex, resetPage } =
    useDashboardPagination();
  const [sorting, setSorting] = useDashboardTableSort({
    onSortChange: resetPage,
  });
  const columnVisibility = usePreferencesStore((s) => s.columnVisibility);
  const setColumnVisibility = usePreferencesStore((s) => s.setColumnVisibility);

  // Use refs to store current state so columns can be memoized
  // without being recreated on every selection/sort change
  const sortingRef = useRef(sorting);
  sortingRef.current = sorting;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Create a stable sorting helper that reads from ref instead of closing over state
  // This prevents columns from being recreated on every render
  const withUnverifiedLast = useCallback(
    createUnverifiedLastSorter((columnId) => {
      const columnSort = sortingRef.current.find((s) => s.id === columnId);
      return columnSort?.desc ?? false;
    }),
    [], // Empty deps - reads from ref, not state
  );

  const columns = useMemo(
    () =>
      createColumns({
        selectedIdsRef,
        onToggleSelect,
        onVerify,
        onRemove,
        onArchive,
        onToggleMuted,
        withUnverifiedLast,
      }),
    // Note: selectedIds is accessed via ref (selectedIdsRef) to avoid recreating
    // columns on every selection change. The table re-renders cells independently.
    [
      onToggleSelect,
      onRemove,
      onArchive,
      onToggleMuted,
      onVerify,
      withUnverifiedLast,
    ],
  );

  const table = useReactTable({
    data: domains,
    columns,
    state: { sorting, pagination, columnVisibility },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const newPagination =
        typeof updater === "function" ? updater(pagination) : updater;
      setPageIndex(newPagination.pageIndex);
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Expose table instance to parent for column visibility menu in filters bar
  useEffect(() => {
    onTableReady?.(table);
  }, [table, onTableReady]);

  return (
    <div className="overflow-hidden rounded-xl border border-black/15 bg-background/60 shadow-2xl shadow-black/10 dark:border-white/15">
      <ScrollArea className="w-full">
        <table className="w-full text-[13px]" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col
                key={column.id}
                style={{
                  width: column.getSize(),
                }}
              />
            ))}
          </colgroup>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="min-w-full border-black/10 border-b bg-muted/30 dark:border-white/10"
              >
                {headerGroup.headers.map((header) => {
                  const isSelectColumn = header.column.id === "select";
                  const isDomainColumn = header.column.id === "domainName";

                  // The "Domain" header spans both the selection column (favicon/checkbox)
                  // and the domain name column, so we don't render a separate header cell
                  // for the selection column.
                  if (isSelectColumn) {
                    return null;
                  }

                  const canSort = header.column.getCanSort();
                  // Get sort state directly from our state instead of table API
                  // (header.column.getIsSorted() can return stale values)
                  const sortEntry = sorting.find(
                    (s) => s.id === header.column.id,
                  );
                  const isSorted = sortEntry
                    ? sortEntry.desc
                      ? "desc"
                      : "asc"
                    : false;

                  const headerContent =
                    header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        className={cn(
                          "-ml-1.5 inline-flex h-6 cursor-pointer select-none items-center gap-1 rounded px-1.5 text-xs leading-none transition-colors hover:bg-accent hover:text-foreground",
                          isSorted && "text-foreground",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <SortIndicator isSorted={isSorted} />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    );

                  return (
                    <th
                      key={header.id}
                      colSpan={isDomainColumn ? 2 : header.colSpan}
                      style={{
                        width: header.column.getSize(),
                      }}
                      className={cn(
                        "h-9 px-2.5 text-left align-middle font-medium text-muted-foreground text-xs first:pl-4 last:pr-4",
                      )}
                    >
                      {headerContent}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-16 text-center text-muted-foreground text-sm"
                >
                  No domains tracked yet.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {table.getRowModel().rows.map((row) => {
                  const isUnverified = !row.original.verified;
                  const isSelected = selectedIds.has(row.original.id);
                  const cells = row.getVisibleCells();

                  if (isUnverified) {
                    return (
                      <UnverifiedTableRow
                        key={row.id}
                        rowId={row.id}
                        cells={cells}
                        original={row.original}
                        isSelected={isSelected}
                        onVerify={onVerify}
                        onRemove={onRemove}
                      />
                    );
                  }

                  return (
                    <VerifiedTableRow
                      key={row.id}
                      rowId={row.id}
                      cells={cells}
                      isSelected={isSelected}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </ScrollArea>

      {/* Pagination controls - only show if there are domains */}
      {domains.length > 0 && (
        <DashboardTablePagination
          pageIndex={table.getState().pagination.pageIndex}
          pageSize={pageSize}
          pageCount={table.getPageCount()}
          canPreviousPage={table.getCanPreviousPage()}
          canNextPage={table.getCanNextPage()}
          onPageChange={(index) => setPageIndex(index)}
          onPageSizeChange={setPageSize}
        />
      )}

      {/* Upgrade CTA banner for free tier users */}
      {<UpgradeRow />}
    </div>
  );
}
