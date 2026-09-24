import type { SortingState } from "@tanstack/react-table";

import { EXPIRING_CRITICAL_DAYS, EXPIRING_SOON_DAYS } from "@domainstack/constants";
import type { ProviderCategory, TrackedDomainWithDetails } from "@domainstack/types";
import { calculateDaysRemaining } from "@domainstack/utils/expiry";

// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

interface AvailableProvider {
  id: string;
  name: string;
  domain: string | null;
}

export type AvailableProvidersByCategory = Record<ProviderCategory, AvailableProvider[]>;

/** Filter values for domain verification status */
const STATUS_FILTERS = ["verified", "pending"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Filter values for domain health status */
export const HEALTH_FILTERS = ["healthy", "expiring", "expired"] as const;
export type HealthFilter = (typeof HEALTH_FILTERS)[number];

/** Valid filter values for runtime validation of URL params */
const VALID_STATUS_FILTERS = new Set<StatusFilter>(STATUS_FILTERS);

/** Valid health filter values for runtime validation of URL params */
const VALID_HEALTH_FILTERS = new Set<HealthFilter>(HEALTH_FILTERS);

/** Severity shown on a domain's health badge. */
export type HealthSeverity = "healthy" | "warning" | "critical" | "unknown";

/**
 * Whole days until a tracked domain expires, or null when there is nothing to
 * count (unverified, missing date, unparseable date).
 *
 * Every dashboard reading of "days left" goes through here so the filter, the
 * summary counts, the row badge, and the sort all classify a domain the same
 * way. `calculateDaysRemaining` is the same helper the expiry notifications
 * use, so the dashboard and the emails agree on the day count too.
 */
function getDaysUntilExpiry(
  expirationDate: Date | null,
  verified: boolean,
  now: Date,
): number | null {
  if (!verified || !expirationDate || Number.isNaN(expirationDate.getTime())) return null;

  const days = calculateDaysRemaining(expirationDate, now);
  return Number.isNaN(days) ? null : days;
}

/**
 * Determine health status based on expiration date
 */
function getHealthStatus(
  expirationDate: Date | null,
  verified: boolean,
  now: Date,
): HealthFilter | null {
  const daysUntilExpiry = getDaysUntilExpiry(expirationDate, verified, now);
  if (daysUntilExpiry === null) return null;

  if (daysUntilExpiry <= 0) return "expired";
  if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return "expiring";
  return "healthy";
}

/**
 * Determine badge severity based on expiration date.
 *
 * Shares its day count and thresholds with the health filter above, so a row
 * badge can never contradict the "Expiring Soon" summary beside it.
 */
export function getHealthSeverity(
  expirationDate: Date | null,
  verified: boolean,
  now: Date,
): HealthSeverity {
  const daysUntilExpiry = getDaysUntilExpiry(expirationDate, verified, now);
  if (daysUntilExpiry === null) return "unknown";

  if (daysUntilExpiry <= EXPIRING_CRITICAL_DAYS) return "critical";
  if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return "warning";
  return "healthy";
}

export const DASHBOARD_VIEW_MODE_OPTIONS = ["grid", "table"] as const;
export type DashboardViewModeOptions = (typeof DASHBOARD_VIEW_MODE_OPTIONS)[number];

export const DASHBOARD_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type DashboardPageSizeOptions = (typeof DASHBOARD_PAGE_SIZE_OPTIONS)[number];

/** True when the current page is past the last page of `itemCount` rows. */
export function isPagePastEnd(itemCount: number, pageIndex: number, pageSize: number): boolean {
  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
  return pageIndex >= pageCount;
}

export interface DashboardPreferencesDefault {
  viewMode: DashboardViewModeOptions;
  pageSize: DashboardPageSizeOptions;
  columnVisibility: Record<string, boolean>;
}

export const DASHBOARD_PREFERENCES_DEFAULT: DashboardPreferencesDefault = {
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

type SortKey = string | number | null;

/**
 * The value each sortable column orders by, shared by the grid and the table
 * (which uses manual sorting) so both views order the same data identically.
 * `unverifiedLast` columns push pending domains to the end in either direction.
 */
const SORT_COLUMNS: Record<
  string,
  { key: (domain: TrackedDomainWithDetails, now: Date | null) => SortKey; unverifiedLast: boolean }
> = {
  domainName: { key: (d) => d.domainName, unverifiedLast: false },
  verified: { key: (d) => (d.verified ? 0 : 1), unverifiedLast: false },
  // Health severity rises as days-left falls, so days-left orders critical ->
  // warning -> healthy, with unknown (no usable date) last. Before the clock
  // hydrates every domain counts as unknown, which keeps the incoming order.
  health: {
    key: (d, now) => (now ? getDaysUntilExpiry(d.expirationDate, d.verified, now) : null),
    unverifiedLast: true,
  },
  expirationDate: { key: (d) => d.expirationDate?.getTime() ?? null, unverifiedLast: true },
  registrar: { key: (d) => d.registrar.name, unverifiedLast: true },
  dns: { key: (d) => d.dns.name, unverifiedLast: true },
  hosting: { key: (d) => d.hosting.name, unverifiedLast: true },
  email: { key: (d) => d.email.name, unverifiedLast: true },
  ca: { key: (d) => d.ca.name, unverifiedLast: true },
  registrationDate: { key: (d) => d.registrationDate?.getTime() ?? null, unverifiedLast: true },
  createdAt: { key: (d) => d.createdAt.getTime(), unverifiedLast: false },
};

function isMissing(key: SortKey): key is null {
  return key === null || key === "" || Number.isNaN(key);
}

/**
 * Sort domains by a "columnId.direction" sort string. Domains missing the
 * sorted value always land after those that have it, in either direction.
 * `now` is null until the clock hydrates; only the health column needs it.
 */
export function sortDomains(
  domains: TrackedDomainWithDetails[],
  sort: string,
  now: Date | null,
): TrackedDomainWithDetails[] {
  const [{ id, desc }] = parseSortParam(sort);
  // Own keys only, so a URL naming an inherited property like "constructor" can't match.
  const column = Object.hasOwn(SORT_COLUMNS, id) ? SORT_COLUMNS[id] : undefined;
  if (!column) return domains;

  return domains.toSorted((a, b) => {
    if (column.unverifiedLast && a.verified !== b.verified) return a.verified ? -1 : 1;

    const aKey = column.key(a, now);
    const bKey = column.key(b, now);
    if (isMissing(aKey) || isMissing(bKey)) {
      return Number(isMissing(aKey)) - Number(isMissing(bKey));
    }

    const order =
      typeof aKey === "string" && typeof bKey === "string"
        ? aKey.localeCompare(bKey)
        : Number(aKey) - Number(bKey);
    return desc ? -order : order;
  });
}

/** Table sorts fall back to the default when the URL names a column that doesn't exist. */
export function toTableSort(sort: string): string {
  const [{ id }] = parseSortParam(sort);
  return Object.hasOwn(SORT_COLUMNS, id) && sort === serializeSortState(parseSortParam(sort))
    ? sort
    : DEFAULT_SORT;
}

/** Grid sort options fall back to the default when the URL holds a table-only column. */
export function toGridSort(sort: string): SortOption {
  return SORT_OPTIONS.some((opt) => opt.value === sort) ? (sort as SortOption) : DEFAULT_SORT;
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

// ---------------------------------------------------------------------------
// Domain Data Extraction
// ---------------------------------------------------------------------------

/**
 * Extract unique TLDs from domains for filter dropdown
 */
export function extractAvailableTlds(domains: TrackedDomainWithDetails[]): string[] {
  const tldSet = new Set<string>();
  for (const domain of domains) {
    if (domain.tld) tldSet.add(domain.tld);
  }
  return Array.from(tldSet).sort();
}

/**
 * Extract unique providers from domains, grouped by category
 */
export function extractAvailableProviders(
  domains: TrackedDomainWithDetails[],
): AvailableProvidersByCategory {
  const providersByCategory: AvailableProvidersByCategory = {
    registrar: [],
    dns: [],
    hosting: [],
    email: [],
    ca: [],
  };

  const registrarMap = new Map<string, AvailableProvider>();
  const dnsMap = new Map<string, AvailableProvider>();
  const hostingMap = new Map<string, AvailableProvider>();
  const emailMap = new Map<string, AvailableProvider>();
  const caMap = new Map<string, AvailableProvider>();

  for (const domain of domains) {
    if (!domain.verified || domain.archivedAt !== null) continue;

    const { registrar, dns, hosting, email, ca } = domain;

    if (registrar.id && registrar.name) {
      if (!registrarMap.has(registrar.id)) {
        registrarMap.set(registrar.id, {
          id: registrar.id,
          name: registrar.name,
          domain: registrar.domain,
        });
      }
    }
    if (dns.id && dns.name) {
      if (!dnsMap.has(dns.id)) {
        dnsMap.set(dns.id, {
          id: dns.id,
          name: dns.name,
          domain: dns.domain,
        });
      }
    }
    if (hosting.id && hosting.name) {
      if (!hostingMap.has(hosting.id)) {
        hostingMap.set(hosting.id, {
          id: hosting.id,
          name: hosting.name,
          domain: hosting.domain,
        });
      }
    }
    if (email.id && email.name) {
      if (!emailMap.has(email.id)) {
        emailMap.set(email.id, {
          id: email.id,
          name: email.name,
          domain: email.domain,
        });
      }
    }
    if (ca.id && ca.name) {
      if (!caMap.has(ca.id)) {
        caMap.set(ca.id, {
          id: ca.id,
          name: ca.name,
          domain: ca.domain,
        });
      }
    }
  }

  providersByCategory.registrar = Array.from(registrarMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  providersByCategory.dns = Array.from(dnsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  providersByCategory.hosting = Array.from(hostingMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  providersByCategory.email = Array.from(emailMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  providersByCategory.ca = Array.from(caMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return providersByCategory;
}

/**
 * Create a flat set of all valid provider IDs for validation
 */
export function getValidProviderIds(availableProviders: AvailableProvidersByCategory): Set<string> {
  const ids = new Set<string>();
  for (const category of Object.values(availableProviders)) {
    for (const provider of category) {
      ids.add(provider.id);
    }
  }
  return ids;
}

/**
 * Compute health stats for the dashboard badges.
 * `expiringSoon` matches the Expiring Soon filter (not expired).
 */
export function computeHealthStats(domains: TrackedDomainWithDetails[], now: Date) {
  let expiringSoon = 0;
  let pendingVerification = 0;

  for (const domain of domains) {
    if (!domain.verified) {
      pendingVerification++;
      continue;
    }
    if (getHealthStatus(domain.expirationDate, domain.verified, now) === "expiring") {
      expiringSoon++;
    }
  }

  return { expiringSoon, pendingVerification };
}

// ---------------------------------------------------------------------------
// Filter Validation & Filtering
// ---------------------------------------------------------------------------

/**
 * Validate and filter status values from URL params
 */
export function validateStatusFilters(values: string[]): StatusFilter[] {
  return values.filter((s): s is StatusFilter => VALID_STATUS_FILTERS.has(s as StatusFilter));
}

/**
 * Validate and filter health values from URL params
 */
export function validateHealthFilters(values: string[]): HealthFilter[] {
  return values.filter((h): h is HealthFilter => VALID_HEALTH_FILTERS.has(h as HealthFilter));
}

/**
 * Filter criteria for domain filtering
 */
export interface DomainFilterCriteria {
  search: string;
  domainId: string | null;
  status: StatusFilter[];
  health: HealthFilter[];
  tlds: string[];
  providers: string[];
}

/**
 * Filter domains based on search, status, health, TLDs, and providers.
 * `now` is null until the clock hydrates; the health filter waits for it.
 */
export function filterDomains(
  domains: TrackedDomainWithDetails[],
  criteria: DomainFilterCriteria,
  validProviderIds: Set<string>,
  now: Date | null,
): TrackedDomainWithDetails[] {
  const statusSet = new Set(criteria.status);
  const healthSet = new Set(criteria.health);
  const tldSet = new Set(criteria.tlds);
  // Trimmed so pasted values and trailing spaces still match.
  const searchLower = criteria.search.trim().toLowerCase();

  return domains.filter((domain) => {
    // Filter by specific domain ID
    if (criteria.domainId && domain.id !== criteria.domainId) return false;

    // Filter by search term
    if (searchLower && !domain.domainName.toLowerCase().includes(searchLower)) {
      return false;
    }

    // Filter by verification status
    if (statusSet.size > 0) {
      const domainStatus = domain.verified ? "verified" : "pending";
      if (!statusSet.has(domainStatus)) return false;
    }

    // Filter by health status
    if (healthSet.size > 0 && now) {
      const healthStatus = getHealthStatus(domain.expirationDate, domain.verified, now);
      if (!healthStatus || !healthSet.has(healthStatus)) return false;
    }

    // Filter by TLD
    if (tldSet.size > 0 && !tldSet.has(domain.tld)) {
      return false;
    }

    // Filter by provider
    if (criteria.providers.length > 0) {
      if (!domain.verified) return false;
      const validSelectedProviders = criteria.providers.filter((id) => validProviderIds.has(id));
      if (validSelectedProviders.length === 0) return true;
      const providerSet = new Set(validSelectedProviders);
      const hasMatch =
        (domain.registrar.id && providerSet.has(domain.registrar.id)) ||
        (domain.dns.id && providerSet.has(domain.dns.id)) ||
        (domain.hosting.id && providerSet.has(domain.hosting.id)) ||
        (domain.email.id && providerSet.has(domain.email.id)) ||
        (domain.ca.id && providerSet.has(domain.ca.id));
      if (!hasMatch) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Confirmation Dialog
// ---------------------------------------------------------------------------

export type ConfirmAction =
  | { type: "remove"; domainId: string; domainName: string }
  | { type: "archive"; domainId: string; domainName: string }
  | { type: "bulk-archive"; domainIds: string[]; count: number }
  | { type: "bulk-delete"; domainIds: string[]; count: number };

export function getConfirmDialogContent(action: ConfirmAction) {
  switch (action.type) {
    case "remove":
      return {
        title: "Remove domain?",
        description: `Are you sure you want to stop tracking ${action.domainName}?`,
        confirmLabel: "Remove",
        variant: "destructive" as const,
      };
    case "archive":
      return {
        title: "Archive domain?",
        description: `Are you sure you want to archive ${action.domainName}? You can reactivate it later from the Archived section.`,
        confirmLabel: "Archive",
        variant: "default" as const,
      };
    case "bulk-archive":
      return {
        title: `Archive ${action.count} domain${action.count === 1 ? "" : "s"}?`,
        description: `Are you sure you want to archive ${action.count} domain${action.count === 1 ? "" : "s"}? You can reactivate them later from the Archived section.`,
        confirmLabel: "Archive All",
        variant: "default" as const,
      };
    case "bulk-delete":
      return {
        title: `Delete ${action.count} domain${action.count === 1 ? "" : "s"}?`,
        description: `Are you sure you want to stop tracking ${action.count} domain${action.count === 1 ? "" : "s"}?`,
        confirmLabel: "Delete All",
        variant: "destructive" as const,
      };
  }
}
