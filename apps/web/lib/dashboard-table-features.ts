import {
  columnSizingFeature,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  type Table,
  tableFeatures,
} from "@tanstack/react-table";

import type { TrackedDomainWithDetails } from "@domainstack/types";

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
});

export type DashboardTableFeatures = typeof dashboardTableFeatures;

/** Convenience alias for the dashboard's table instance type. */
export type DashboardTable = Table<DashboardTableFeatures, TrackedDomainWithDetails>;
