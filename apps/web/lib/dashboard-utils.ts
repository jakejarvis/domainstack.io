import { EXPIRING_SOON_DAYS } from "@domainstack/constants";
import type { TrackedDomainWithDetails } from "@domainstack/types";
import type { SortingState } from "@tanstack/react-table";

// ---------------------------------------------------------------------------
// Provider Types
// ---------------------------------------------------------------------------

export interface AvailableProvider {
  id: string;
  name: string;
  domain: string | null;
}

export type AvailableProvidersByCategory = Record<
  "registrar" | "dns" | "hosting" | "email" | "ca",
  AvailableProvider[]
>;

/** Filter types for domain verification status */
export type StatusFilter = "verified" | "pending";

/** Filter types for domain health status */
export type HealthFilter = "healthy" | "expiring" | "expired";

/** Valid filter values for runtime validation of URL params */
const VALID_STATUS_FILTERS: readonly StatusFilter[] = ["verified", "pending"];

/** Valid health filter values for runtime validation of URL params */
const VALID_HEALTH_FILTERS: readonly HealthFilter[] = [
  "healthy",
  "expiring",
  "expired",
];

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

// ---------------------------------------------------------------------------
// Domain Data Extraction
// ---------------------------------------------------------------------------

/**
 * Extract unique TLDs from domains for filter dropdown
 */
export function extractAvailableTlds(
  domains: TrackedDomainWithDetails[],
): string[] {
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

    if (domain.registrar.id && domain.registrar.name) {
      if (!registrarMap.has(domain.registrar.id)) {
        registrarMap.set(domain.registrar.id, {
          id: domain.registrar.id,
          name: domain.registrar.name,
          domain: domain.registrar.domain,
        });
      }
    }
    if (domain.dns.id && domain.dns.name) {
      if (!dnsMap.has(domain.dns.id)) {
        dnsMap.set(domain.dns.id, {
          id: domain.dns.id,
          name: domain.dns.name,
          domain: domain.dns.domain,
        });
      }
    }
    if (domain.hosting.id && domain.hosting.name) {
      if (!hostingMap.has(domain.hosting.id)) {
        hostingMap.set(domain.hosting.id, {
          id: domain.hosting.id,
          name: domain.hosting.name,
          domain: domain.hosting.domain,
        });
      }
    }
    if (domain.email.id && domain.email.name) {
      if (!emailMap.has(domain.email.id)) {
        emailMap.set(domain.email.id, {
          id: domain.email.id,
          name: domain.email.name,
          domain: domain.email.domain,
        });
      }
    }
    if (domain.ca.id && domain.ca.name) {
      if (!caMap.has(domain.ca.id)) {
        caMap.set(domain.ca.id, {
          id: domain.ca.id,
          name: domain.ca.name,
          domain: domain.ca.domain,
        });
      }
    }
  }

  providersByCategory.registrar = Array.from(registrarMap.values()).sort(
    (a, b) => a.name.localeCompare(b.name),
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
  providersByCategory.ca = Array.from(caMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return providersByCategory;
}

/**
 * Create a flat set of all valid provider IDs for validation
 */
export function getValidProviderIds(
  availableProviders: AvailableProvidersByCategory,
): Set<string> {
  const ids = new Set<string>();
  for (const category of Object.values(availableProviders)) {
    for (const provider of category) {
      ids.add(provider.id);
    }
  }
  return ids;
}

/**
 * Compute health stats for domains (expiring soon + pending verification counts)
 */
export function computeHealthStats(
  domains: TrackedDomainWithDetails[],
  now: Date,
) {
  let expiringSoon = 0;
  let pendingVerification = 0;

  for (const domain of domains) {
    if (!domain.verified) {
      pendingVerification++;
      continue;
    }
    const healthStatus = getHealthStatus(
      domain.expirationDate,
      domain.verified,
      now,
    );
    if (healthStatus === "expiring" || healthStatus === "expired") {
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
  return values.filter((s): s is StatusFilter =>
    VALID_STATUS_FILTERS.includes(s as StatusFilter),
  );
}

/**
 * Validate and filter health values from URL params
 */
export function validateHealthFilters(values: string[]): HealthFilter[] {
  return values.filter((h): h is HealthFilter =>
    VALID_HEALTH_FILTERS.includes(h as HealthFilter),
  );
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
 * Filter domains based on search, status, health, TLDs, and providers
 */
export function filterDomains(
  domains: TrackedDomainWithDetails[],
  criteria: DomainFilterCriteria,
  validProviderIds: Set<string>,
  now: Date,
): TrackedDomainWithDetails[] {
  return domains.filter((domain) => {
    // Filter by specific domain ID
    if (criteria.domainId && domain.id !== criteria.domainId) return false;

    // Filter by search term
    if (criteria.search) {
      const searchLower = criteria.search.toLowerCase();
      if (!domain.domainName.toLowerCase().includes(searchLower)) return false;
    }

    // Filter by verification status
    if (criteria.status.length > 0) {
      const domainStatus = domain.verified ? "verified" : "pending";
      if (!criteria.status.includes(domainStatus)) return false;
    }

    // Filter by health status
    if (criteria.health.length > 0) {
      const healthStatus = getHealthStatus(
        domain.expirationDate,
        domain.verified,
        now,
      );
      if (!healthStatus || !criteria.health.includes(healthStatus))
        return false;
    }

    // Filter by TLD
    if (criteria.tlds.length > 0 && !criteria.tlds.includes(domain.tld)) {
      return false;
    }

    // Filter by provider
    if (criteria.providers.length > 0) {
      if (!domain.verified) return false;
      const validSelectedProviders = criteria.providers.filter((id) =>
        validProviderIds.has(id),
      );
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
        title: `Archive ${action.count} domains?`,
        description: `Are you sure you want to archive ${action.count} domain${action.count === 1 ? "" : "s"}? You can reactivate them later from the Archived section.`,
        confirmLabel: "Archive All",
        variant: "default" as const,
      };
    case "bulk-delete":
      return {
        title: `Delete ${action.count} domains?`,
        description: `Are you sure you want to stop tracking ${action.count} domain${action.count === 1 ? "" : "s"}?`,
        confirmLabel: "Delete All",
        variant: "destructive" as const,
      };
  }
}
