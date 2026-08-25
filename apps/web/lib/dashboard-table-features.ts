import {
  columnSizingFeature,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * TanStack Table v9 requires explicitly registering the features (and their
 * row models) a table uses. The dashboard table only needs sorting,
 * pagination, column visibility, and column sizing - selection is handled
 * outside the table via `useDashboardSelection`, and there's no filtering,
 * grouping, expansion, or pinning.
 *
 * @see https://tanstack.com/table/latest/docs/framework/react/guide/migrating
 */
export const dashboardTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  // A column without an explicit `sortFn` defaults to `"auto"`, which resolves
  // `alphanumeric`, `text`, or `datetime` out of this registry from sampled
  // values. Only the domain name column relies on that, so register just the
  // two string sorters instead of spreading the whole `sortFns` bundle. Every
  // other sortable column passes its comparator inline.
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  // Per-table column meta type, replacing v8-style global `declare module`
  // augmentation of `ColumnMeta` (which would leak into every table).
  columnMeta: metaHelper<{ className?: string }>(),
});

export type DashboardTableFeatures = typeof dashboardTableFeatures;
