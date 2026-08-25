import type { OnChangeFn, PaginationState, SortingState } from "@tanstack/react-table";
import { useTable } from "@tanstack/react-table";
import { AnimatePresence } from "motion/react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";

import {
  createColumns,
  createUnverifiedLastSorter,
} from "@/components/dashboard/dashboard-table-columns";
import { DashboardTablePagination } from "@/components/dashboard/dashboard-table-pagination";
import { SortIndicator } from "@/components/dashboard/sort-indicator";
import { UnverifiedTableRow } from "@/components/dashboard/unverified-table-row";
import { UpgradeRow } from "@/components/dashboard/upgrade-row";
import { VerifiedTableRow } from "@/components/dashboard/verified-table-row";
import { useDashboardActions, useDashboardPaginationContext } from "@/context/dashboard-context";
import {
  dashboardTableFeatures,
  type DashboardTableFeatures,
} from "@/lib/dashboard-table-features";
import { DEFAULT_SORT, parseSortParam, serializeSortState } from "@/lib/dashboard-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import { ScrollArea } from "@domainstack/ui/scroll-area";
import { cn } from "@domainstack/ui/utils";

type DashboardTableProps = {
  domains: TrackedDomainWithDetails[];
};

export function DashboardTable({ domains }: DashboardTableProps) {
  const { onVerify, onRemove, onArchive, onToggleMuted } = useDashboardActions();
  const { pageIndex, pageSize, setPageSize, setPageIndex, resetPage } =
    useDashboardPaginationContext();
  const pagination = useMemo(
    (): PaginationState => ({ pageIndex, pageSize }),
    [pageIndex, pageSize],
  );

  // Table sort state with URL persistence
  const [sortParam, setSortParam] = useQueryState(
    "sort",
    parseAsString.withDefault(DEFAULT_SORT).withOptions({
      shallow: true,
      clearOnDefault: true,
    }),
  );
  const sorting = useMemo(() => parseSortParam(sortParam), [sortParam]);
  const setSorting = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      setSortParam(serializeSortState(newSorting));
      resetPage();
    },
    [sorting, setSortParam, resetPage],
  );

  const columnVisibility = usePreferencesStore((s) => s.columnVisibility);
  const setColumnVisibility = usePreferencesStore((s) => s.setColumnVisibility);

  const withUnverifiedLast = useMemo(
    () =>
      createUnverifiedLastSorter((columnId) => {
        const columnSort = sorting.find((s) => s.id === columnId);
        return columnSort?.desc ?? false;
      }),
    [sorting],
  );

  const columns = useMemo(
    () =>
      createColumns({
        onVerify,
        onRemove,
        onArchive,
        onToggleMuted,
        withUnverifiedLast,
      }),
    [onRemove, onArchive, onToggleMuted, onVerify, withUnverifiedLast],
  );

  const tableState = useMemo(
    () => ({ sorting, pagination, columnVisibility }),
    [sorting, pagination, columnVisibility],
  );

  const onPaginationChange = useCallback<OnChangeFn<PaginationState>>(
    (updater) => {
      const newPagination = typeof updater === "function" ? updater(pagination) : updater;
      setPageIndex(newPagination.pageIndex);
    },
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
      onSortingChange: setSorting,
      onPaginationChange,
      onColumnVisibilityChange: setColumnVisibility,
    }),
    [domains, columns, tableState, setSorting, onPaginationChange, setColumnVisibility],
  );

  const table = useTable<DashboardTableFeatures, TrackedDomainWithDetails>(tableOptions);

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
                className="min-w-full border-b border-black/10 bg-muted/30 dark:border-white/10"
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
    </div>
  );
}
