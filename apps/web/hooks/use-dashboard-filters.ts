import type { TrackedDomainWithDetails } from "@domainstack/types";
import { parseAsArrayOf, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useMemo, useTransition } from "react";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import {
  type AvailableProvidersByCategory,
  computeHealthStats,
  type DomainFilterCriteria,
  extractAvailableProviders,
  extractAvailableTlds,
  filterDomains,
  getValidProviderIds,
  type HealthFilter,
  type StatusFilter,
  validateHealthFilters,
  validateStatusFilters,
} from "@/lib/dashboard-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardFilterState {
  search: string;
  status: StatusFilter[];
  health: HealthFilter[];
  tlds: string[];
  providers: string[];
  domainId: string | null;
  filteredDomainName: string | null;
  availableTlds: string[];
  availableProviders: AvailableProvidersByCategory;
  hasActiveFilters: boolean;
  stats: { expiringSoon: number; pendingVerification: number };
  filteredDomains: TrackedDomainWithDetails[];
}

export interface DashboardFilterActions {
  setSearch: (value: string) => void;
  setStatus: (values: StatusFilter[]) => void;
  setHealth: (values: HealthFilter[]) => void;
  setTlds: (values: string[]) => void;
  setProviders: (values: string[]) => void;
  clearFilters: () => void;
  applyHealthFilter: (filter: HealthFilter | "pending") => void;
  clearDomainId: () => void;
}

export interface UseDashboardFiltersReturn {
  state: DashboardFilterState;
  actions: DashboardFilterActions;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Encapsulates all dashboard filter state and logic.
 *
 * Manages:
 * - URL state via nuqs (search, status, health, tlds, providers, domainId)
 * - Validation of filter values from URL params
 * - Computed values (availableTlds, availableProviders, stats, filteredDomains)
 * - All filter setters with startTransition for non-blocking updates
 */
export function useDashboardFilters(
  domains: TrackedDomainWithDetails[],
): UseDashboardFiltersReturn {
  const [, startTransition] = useTransition();

  // Use shared hydrated time to avoid extra re-renders
  const now = useHydratedNow();

  // URL state with nuqs
  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString.withDefault(""),
      status: parseAsArrayOf(parseAsString).withDefault([]),
      health: parseAsArrayOf(parseAsString).withDefault([]),
      tlds: parseAsArrayOf(parseAsString).withDefault([]),
      providers: parseAsArrayOf(parseAsString).withDefault([]),
      domainId: parseAsString,
    },
    {
      shallow: true,
      clearOnDefault: true,
    },
  );

  // Validate status and health filter values from URL params
  const validatedStatus = useMemo(
    () => validateStatusFilters(filters.status),
    [filters.status],
  );

  const validatedHealth = useMemo(
    () => validateHealthFilters(filters.health),
    [filters.health],
  );

  // Extract unique TLDs from domains for the dropdown
  const availableTlds = useMemo(() => extractAvailableTlds(domains), [domains]);

  // Extract unique providers from domains, grouped by category
  const availableProviders = useMemo(
    () => extractAvailableProviders(domains),
    [domains],
  );

  // Create a flat set of all valid provider IDs for validation
  const validProviderIds = useMemo(
    () => getValidProviderIds(availableProviders),
    [availableProviders],
  );

  // Check if any filters are active
  const hasActiveFilters =
    filters.search.length > 0 ||
    validatedStatus.length > 0 ||
    validatedHealth.length > 0 ||
    filters.tlds.length > 0 ||
    filters.providers.length > 0 ||
    !!filters.domainId;

  // Filter domains based on current filters
  const filterCriteria: DomainFilterCriteria = useMemo(
    () => ({
      search: filters.search,
      domainId: filters.domainId,
      status: validatedStatus,
      health: validatedHealth,
      tlds: filters.tlds,
      providers: filters.providers,
    }),
    [filters, validatedStatus, validatedHealth],
  );

  const filteredDomains = useMemo(
    () =>
      now
        ? filterDomains(domains, filterCriteria, validProviderIds, now)
        : domains,
    [domains, filterCriteria, validProviderIds, now],
  );

  // Compute stats for health summary
  const stats = useMemo(
    () =>
      now
        ? computeHealthStats(domains, now)
        : { expiringSoon: 0, pendingVerification: 0 },
    [domains, now],
  );

  // Compute filtered domain name for display
  const filteredDomainName = filters.domainId
    ? (domains.find((d) => d.id === filters.domainId)?.domainName ?? null)
    : null;

  // ---------------------------------------------------------------------------
  // Setters (wrapped in startTransition for non-blocking updates)
  // ---------------------------------------------------------------------------

  const setSearch = useCallback(
    (value: string) => {
      startTransition(() => {
        setFilters({ search: value || null, domainId: null });
      });
    },
    [setFilters],
  );

  const setStatus = useCallback(
    (values: StatusFilter[]) => {
      startTransition(() => {
        setFilters({
          status: values.length > 0 ? values : null,
          domainId: null,
        });
      });
    },
    [setFilters],
  );

  const setHealth = useCallback(
    (values: HealthFilter[]) => {
      startTransition(() => {
        setFilters({
          health: values.length > 0 ? values : null,
          domainId: null,
        });
      });
    },
    [setFilters],
  );

  const setTlds = useCallback(
    (values: string[]) => {
      startTransition(() => {
        setFilters({ tlds: values.length > 0 ? values : null, domainId: null });
      });
    },
    [setFilters],
  );

  const setProviders = useCallback(
    (values: string[]) => {
      startTransition(() => {
        setFilters({
          providers: values.length > 0 ? values : null,
          domainId: null,
        });
      });
    },
    [setFilters],
  );

  const clearFilters = useCallback(() => {
    setFilters({
      search: null,
      status: null,
      health: null,
      tlds: null,
      providers: null,
      domainId: null,
    });
  }, [setFilters]);

  const applyHealthFilter = useCallback(
    (filter: HealthFilter | "pending") => {
      if (filter === "pending") {
        setFilters({ status: ["pending"], health: null, domainId: null });
      } else {
        setFilters({ status: null, health: [filter], domainId: null });
      }
    },
    [setFilters],
  );

  const clearDomainId = useCallback(() => {
    setFilters({ domainId: null });
  }, [setFilters]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    state: {
      search: filters.search,
      status: validatedStatus,
      health: validatedHealth,
      tlds: filters.tlds,
      providers: filters.providers,
      domainId: filters.domainId,
      filteredDomainName,
      availableTlds,
      availableProviders,
      hasActiveFilters,
      stats,
      filteredDomains,
    },
    actions: {
      setSearch,
      setStatus,
      setHealth,
      setTlds,
      setProviders,
      clearFilters,
      applyHealthFilter,
      clearDomainId,
    },
  };
}
