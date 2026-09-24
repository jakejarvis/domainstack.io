import type { OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { AnimatePresence } from "motion/react";
import { useMemo } from "react";

import { createColumns } from "@/components/dashboard/dashboard-table-columns";
import { DashboardTablePagination } from "@/components/dashboard/dashboard-table-pagination";
import { SortIndicator } from "@/components/dashboard/sort-indicator";
import { UnverifiedTableRow } from "@/components/dashboard/unverified-table-row";
import { UpgradeRow } from "@/components/dashboard/upgrade-row";
import { VerifiedTableRow } from "@/components/dashboard/verified-table-row";
import { useDashboardActions, useDashboardView } from "@/context/dashboard-context";
import {
  dashboardTableFeatures,
  type DashboardTableFeatures,
} from "@/lib/dashboard-table-features";
import { serializeSortState } from "@/lib/dashboard-utils";
import { useDashboardColumnVisibility, usePreferencesStore } from "@/lib/stores/preferences-store";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { Card } from "@domainstack/ui/card";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { cn } from "@domainstack/ui/utils";

type DashboardTableProps = {
  /** Already filtered and sorted by `useDashboardView`; the table only paginates. */
  domains: TrackedDomainWithDetails[];
};

export function DashboardTable({ domains }: DashboardTableProps) {
  const { onVerify, onRemove, onArchive, onMute } = useDashboardActions();
  const { sorting, setSort, pageIndex, pageSize, setPageSize, setPageIndex } = useDashboardView();
  const pagination = useMemo(
    (): PaginationState => ({ pageIndex, pageSize }),
    [pageIndex, pageSize],
  );

  const onSortingChange = useMemo<OnChangeFn<SortingState>>(
    () => (updater) =>
      setSort(serializeSortState(typeof updater === "function" ? updater(sorting) : updater)),
    [sorting, setSort],
  );

  const columnVisibility = useDashboardColumnVisibility();
  const setColumnVisibility = usePreferencesStore((s) => s.setColumnVisibility);

  const columns = useMemo(
    () => createColumns({ onVerify, onRemove, onArchive, onMute }),
    [onRemove, onArchive, onMute, onVerify],
  );

  const tableState = useMemo(
    () => ({ sorting, pagination, columnVisibility }),
    [sorting, pagination, columnVisibility],
  );

  const onPaginationChange = useMemo<OnChangeFn<PaginationState>>(
    () => (updater) =>
      setPageIndex((typeof updater === "function" ? updater(pagination) : updater).pageIndex),
    [pagination, setPageIndex],
  );

  // Keep options identity stable: `useTable` returns a new React-facing wrapper
  // whenever `tableOptions` identity changes, and tests run without the React
  // Compiler. That wrapper is intentionally unstable, so it stays local to this
  // component and is never lifted into parent state or context.
  // @see https://tanstack.com/table/latest/docs/framework/react/guide/table-context
  const tableOptions = useMemo(
    () => ({
      features: dashboardTableFeatures,
      data: domains,
      columns,
      state: tableState,
      manualSorting: true,
      onSortingChange,
      onPaginationChange,
      onColumnVisibilityChange: setColumnVisibility,
    }),
    [domains, columns, tableState, onSortingChange, onPaginationChange, setColumnVisibility],
  );

  const table = useTable<DashboardTableFeatures, TrackedDomainWithDetails>(tableOptions);

  return (
    <Card className="gap-0 overflow-hidden py-0">
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
              <tr key={headerGroup.id} className="min-w-full border-b bg-muted/30">
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
                  const isSorted = header.column.getIsSorted();

                  const headerContent = header.isPlaceholder ? null : canSort ? (
                    <button
                      type="button"
                      className={cn(
                        "-ml-1.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded px-1.5 text-xs leading-none transition-colors select-none hover:bg-accent hover:text-foreground",
                        isSorted && "text-foreground",
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={header} />
                      <SortIndicator isSorted={isSorted} />
                    </button>
                  ) : (
                    <table.FlexRender header={header} />
                  );

                  return (
                    <th
                      key={header.id}
                      colSpan={isDomainColumn ? 2 : header.colSpan}
                      style={{
                        width: header.column.getSize(),
                      }}
                      className={cn(
                        "h-9 px-2.5 text-left align-middle text-xs font-medium text-muted-foreground first:pl-4 last:pr-4",
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
                  className="h-16 text-center text-sm text-muted-foreground"
                >
                  No domains tracked yet.
                </td>
              </tr>
            ) : (
              <AnimatePresence initial={false}>
                {table.getRowModel().rows.map((row) => {
                  const isUnverified = !row.original.verified;
                  const cells = row.getVisibleCells();

                  if (isUnverified) {
                    return (
                      <UnverifiedTableRow
                        key={row.id}
                        rowId={row.id}
                        cells={cells}
                        original={row.original}
                      />
                    );
                  }

                  return (
                    <VerifiedTableRow
                      key={row.id}
                      rowId={row.id}
                      cells={cells}
                      original={row.original}
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
          pageIndex={table.state.pagination.pageIndex}
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
    </Card>
  );
}
