import type { SortingState } from "@tanstack/react-table";
import { EXPIRING_SOON_DAYS } from "@/lib/constants/notifications";
import type { TrackedDomainWithDetails } from "@/lib/types/tracked-domain";

/** Filter types for domain verification status */
export type StatusFilter = "verified" | "pending";

/** Filter types for domain health status */
export type HealthFilter = "healthy" | "expiring" | "expired";

/**
 * Determine health status based on expiration date
 */
export function getHealthStatus(
  expirationDate: Date | null,
  verified: boolean,
  now: Date,
): HealthFilter | null {
  if (!verified || !expirationDate) return null;

  const daysUntilExpiry = Math.ceil(
    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry <= 0) return "expired";
  if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return "expiring";
  return "healthy";
}

export const DASHBOARD_VIEW_MODE_OPTIONS = ["grid", "table"] as const;
export type DashboardViewModeOptions =
  (typeof DASHBOARD_VIEW_MODE_OPTIONS)[number];

export const DASHBOARD_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type DashboardPageSizeOptions =
  (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number];

export const DASHBOARD_PREFERENCES_STORAGE_KEY = "dashboard-preferences";
export const DASHBOARD_PREFERENCES_DEFAULT: {
  viewMode: DashboardViewModeOptions;
  pageSize: DashboardPageSizeOptions;
  columnVisibility: Record<string, boolean>;
} = {
  viewMode: "grid",
  pageSize: 10,
  columnVisibility: {}, // Empty means all columns visible (default)
};

/**
 * Sort option using table column format: "columnId.direction"
 * This keeps grid and table sorting perfectly aligned
 */
export type SortOption = `${string}.${"asc" | "desc"}`;

export interface SortOptionConfig {
  value: SortOption;
  label: string;
  shortLabel: string;
  direction: "asc" | "desc";
}

export const SORT_OPTIONS: SortOptionConfig[] = [
  {
    value: "domainName.asc",
    label: "Name (A-Z)",
    shortLabel: "Name",
    direction: "asc",
  },
  {
    value: "domainName.desc",
    label: "Name (Z-A)",
    shortLabel: "Name",
    direction: "desc",
  },
  {
    value: "expirationDate.asc",
    label: "Expiry (Soonest first)",
    shortLabel: "Expiry",
    direction: "asc",
  },
  {
    value: "expirationDate.desc",
    label: "Expiry (Furthest first)",
    shortLabel: "Expiry",
    direction: "desc",
  },
  {
    value: "createdAt.desc",
    label: "Recently added",
    shortLabel: "Added",
    direction: "desc",
  },
];

export const DEFAULT_SORT: SortOption = "domainName.asc";

/**
 * Columns where unverified domains should NOT be pushed to the end.
 * For all other columns, unverified/pending domains will appear last.
 */
const COLUMNS_WITHOUT_VERIFICATION_SORT = new Set([
  "domainName",
  "verified",
  "createdAt",
]);

/**
 * Sort domains based on sort option (using table column format).
 * For columns other than domainName, verified, and createdAt,
 * unverified/pending domains are always pushed to the end of the list.
 */
export function sortDomains(
  domains: TrackedDomainWithDetails[],
  sortOption: SortOption,
): TrackedDomainWithDetails[] {
  const sorted = [...domains];
  const [columnId, direction] = sortOption.split(".") as [
    string,
    "asc" | "desc",
  ];
  const isDesc = direction === "desc";
  const pushUnverifiedToEnd = !COLUMNS_WITHOUT_VERIFICATION_SORT.has(columnId);

  switch (columnId) {
    case "domainName":
      sorted.sort((a, b) =>
        isDesc
          ? b.domainName.localeCompare(a.domainName)
          : a.domainName.localeCompare(b.domainName),
      );
      break;
    case "expirationDate":
      sorted.sort((a, b) => {
        // Push unverified domains to the end
        if (pushUnverifiedToEnd) {
          if (!a.verified && b.verified) return 1;
          if (a.verified && !b.verified) return -1;
        }
        // Put domains without expiry date at the end (among their verification group)
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return isDesc
          ? b.expirationDate.getTime() - a.expirationDate.getTime()
          : a.expirationDate.getTime() - b.expirationDate.getTime();
      });
      break;
    case "createdAt":
      sorted.sort((a, b) =>
        isDesc
          ? b.createdAt.getTime() - a.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime(),
      );
      break;
  }

  return sorted;
}

/**
 * Parse sort string to TanStack Table SortingState
 * Format: "columnId.asc" or "columnId.desc"
 */
export function parseSortParam(sortParam: string): SortingState {
  const parts = sortParam.split(".");
  if (parts.length === 2) {
    const [columnId, direction] = parts;
    if (direction === "asc" || direction === "desc") {
      return [{ id: columnId, desc: direction === "desc" }];
    }
  }

  // Default fallback
  return [{ id: "domainName", desc: false }];
}

/**
 * Convert TanStack Table SortingState to sort string
 * Format: "columnId.asc" or "columnId.desc"
 */
export function serializeSortState(sorting: SortingState): string {
  if (sorting.length === 0) return DEFAULT_SORT;

  const [first] = sorting;
  return `${first.id}.${first.desc ? "desc" : "asc"}`;
}
