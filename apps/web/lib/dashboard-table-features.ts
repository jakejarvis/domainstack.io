import {
  columnSizingFeature,
  columnVisibilityFeature,
  createPaginatedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

/**
 * TanStack Table v9 requires explicitly registering the features (and their
 * row models) a table uses. The dashboard table only needs sorting,
 * pagination, column visibility, and column sizing - selection is handled
 * outside the table via `useDashboardSelection`, and there's no filtering,
 * grouping, expansion, or pinning.
 *
 * Sorting is manual: `rowSortingFeature` drives the header toggles and sort
 * state, but rows arrive pre-sorted by `sortDomains` (shared with the grid),
 * so no sorted row model or sort functions are registered.
 *
 * @see https://tanstack.com/table/latest/docs/framework/react/guide/migrating
 */
export const dashboardTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  // Per-table column meta type, replacing v8-style global `declare module`
  // augmentation of `ColumnMeta` (which would leak into every table).
  columnMeta: metaHelper<{ className?: string; showForUnverified?: boolean }>(),
});

export type DashboardTableFeatures = typeof dashboardTableFeatures;
