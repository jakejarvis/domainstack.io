"use client";

import { usePathname } from "next/navigation";
import { parseAsArrayOf, parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { getHealthStatus } from "@/lib/dashboard-utils";
import type {
  HealthFilter,
  ProviderCategory,
  StatusFilter,
  TrackedDomainWithDetails,
} from "@/lib/types";

export type AvailableProvider = {
  id: string;
  name: string;
  domain: string | null;
};

export type AvailableProvidersByCategory = Record<
  ProviderCategory,
  AvailableProvider[]
>;

/**
 * Hook for managing dashboard filter state with URL persistence using nuqs.
 *
 * @param onFilterChange - Optional callback to run when any filter changes (e.g., reset pagination)
 */
export function useDashboardFilters(
  domains: TrackedDomainWithDetails[],
  options?: { onFilterChange?: () => void },
) {
  // Destructure to get stable reference for callbacks
  const onFilterChange = options?.onFilterChange;
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
      // Hidden filter for notification deep links - filters to a single domain by ID
      domainId: parseAsString,
    },
    {
      shallow: true, // Don't trigger server re-render
      clearOnDefault: true, // Keep URL clean
    },
  );

  // Preserve state when navigating to intercepting routes (e.g. /dashboard/add-domain)
  const pathname = usePathname();
  const isDashboardPage = pathname === "/dashboard";
  const [cachedFilters, setCachedFilters] = useState(filters);

  useEffect(() => {
    if (isDashboardPage) {
      setCachedFilters(filters);
    }
  }, [filters, isDashboardPage]);

  const activeFilters = isDashboardPage ? filters : cachedFilters;

  // Extract unique TLDs from domains for the dropdown
  // Note: TLDs are stored in database and URL state without leading dot (e.g., "com")
  // but displayed with a leading dot in the UI (e.g., ".com")
  const availableTlds = useMemo(() => {
    const tldSet = new Set<string>();
    for (const domain of domains) {
      if (domain.tld) tldSet.add(domain.tld);
    }
    return Array.from(tldSet).sort();
  }, [domains]);

  // Extract unique providers from domains, grouped by category
  // Only include providers from verified, non-archived domains
  const availableProviders = useMemo((): AvailableProvidersByCategory => {
    const providersByCategory: AvailableProvidersByCategory = {
      registrar: [],
      dns: [],
      hosting: [],
      email: [],
      ca: [],
    };

    // Use Maps to deduplicate by ID within each category
    const registrarMap = new Map<string, AvailableProvider>();
    const dnsMap = new Map<string, AvailableProvider>();
    const hostingMap = new Map<string, AvailableProvider>();
    const emailMap = new Map<string, AvailableProvider>();
    const caMap = new Map<string, AvailableProvider>();

    for (const domain of domains) {
      // Skip unverified or archived domains
      if (!domain.verified || domain.archivedAt !== null) {
        continue;
      }

      // Extract registrar
      if (domain.registrar.id && domain.registrar.name) {
        if (!registrarMap.has(domain.registrar.id)) {
          registrarMap.set(domain.registrar.id, {
            id: domain.registrar.id,
            name: domain.registrar.name,
            domain: domain.registrar.domain,
          });
        }
      }

      // Extract DNS
      if (domain.dns.id && domain.dns.name) {
        if (!dnsMap.has(domain.dns.id)) {
          dnsMap.set(domain.dns.id, {
            id: domain.dns.id,
            name: domain.dns.name,
            domain: domain.dns.domain,
          });
        }
      }

      // Extract hosting
      if (domain.hosting.id && domain.hosting.name) {
        if (!hostingMap.has(domain.hosting.id)) {
          hostingMap.set(domain.hosting.id, {
            id: domain.hosting.id,
            name: domain.hosting.name,
            domain: domain.hosting.domain,
          });
        }
      }

      // Extract email
      if (domain.email.id && domain.email.name) {
        if (!emailMap.has(domain.email.id)) {
          emailMap.set(domain.email.id, {
            id: domain.email.id,
            name: domain.email.name,
            domain: domain.email.domain,
          });
        }
      }

      // Extract CA
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

    // Convert maps to sorted arrays
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
  }, [domains]);

  // Create a flat set of all valid provider IDs for validation
  const validProviderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const category of Object.values(availableProviders)) {
      for (const provider of category) {
        ids.add(provider.id);
      }
    }
    return ids;
  }, [availableProviders]);

  // Check if any filters are active
  const hasActiveFilters =
    activeFilters.search.length > 0 ||
    activeFilters.status.length > 0 ||
    activeFilters.health.length > 0 ||
    activeFilters.tlds.length > 0 ||
    activeFilters.providers.length > 0 ||
    !!activeFilters.domainId;

  // Filter domains based on current filters
  const filteredDomains = useMemo(() => {
    // During SSR, before we have a 'now' value, return all domains
    if (!now) return domains;

    return domains.filter((domain) => {
      // Domain ID filter (hidden, exact match for notification deep links)
      if (activeFilters.domainId) {
        if (domain.id !== activeFilters.domainId) {
          return false;
        }
      }

      // Search filter
      if (activeFilters.search) {
        const searchLower = activeFilters.search.toLowerCase();
        if (!domain.domainName.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (activeFilters.status.length > 0) {
        const domainStatus = domain.verified ? "verified" : "pending";
        if (!activeFilters.status.includes(domainStatus)) {
          return false;
        }
      }

      // Health filter
      if (activeFilters.health.length > 0) {
        const healthStatus = getHealthStatus(
          domain.expirationDate,
          domain.verified,
          now,
        );
        // If domain has no health status (unverified), only show if no health filter
        if (!healthStatus || !activeFilters.health.includes(healthStatus)) {
          return false;
        }
      }

      // TLD filter
      if (activeFilters.tlds.length > 0) {
        if (!activeFilters.tlds.includes(domain.tld)) {
          return false;
        }
      }

      // Provider filter - match if ANY provider matches
      // Only consider valid provider IDs (from verified, non-archived domains)
      if (activeFilters.providers.length > 0) {
        // Provider filter only applies to verified domains
        // (since availableProviders is built from verified domains only)
        if (!domain.verified) {
          return false;
        }

        // Filter to only valid provider IDs
        const validSelectedProviders = activeFilters.providers.filter((id) =>
          validProviderIds.has(id),
        );

        // If no valid providers after filtering, skip this filter
        if (validSelectedProviders.length === 0) {
          return true;
        }

        const providerSet = new Set(validSelectedProviders);
        let hasMatch = false;

        // Check each provider category using their database IDs
        if (domain.registrar.id && providerSet.has(domain.registrar.id)) {
          hasMatch = true;
        }
        if (domain.dns.id && providerSet.has(domain.dns.id)) {
          hasMatch = true;
        }
        if (domain.hosting.id && providerSet.has(domain.hosting.id)) {
          hasMatch = true;
        }
        if (domain.email.id && providerSet.has(domain.email.id)) {
          hasMatch = true;
        }
        if (domain.ca.id && providerSet.has(domain.ca.id)) {
          hasMatch = true;
        }

        if (!hasMatch) return false;
      }

      return true;
    });
  }, [domains, activeFilters, now, validProviderIds]);

  // Compute stats for health summary
  const stats = useMemo(() => {
    let expiringSoon = 0;
    let pendingVerification = 0;

    // During SSR, before we have a 'now' value, return zeros
    if (!now) {
      return { expiringSoon: 0, pendingVerification: 0 };
    }

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
  }, [domains, now]);

  // Filter setters - all clear domainId to ensure the hidden filter doesn't persist on user interaction
  // Wrapped in useCallback to provide stable references for child components
  const setSearch = useCallback(
    (value: string) => {
      setFilters({ search: value || null, domainId: null });
      onFilterChange?.();
    },
    [setFilters, onFilterChange],
  );

  const setStatus = useCallback(
    (values: StatusFilter[]) => {
      setFilters({ status: values.length > 0 ? values : null, domainId: null });
      onFilterChange?.();
    },
    [setFilters, onFilterChange],
  );

  const setHealth = useCallback(
    (values: HealthFilter[]) => {
      setFilters({ health: values.length > 0 ? values : null, domainId: null });
      onFilterChange?.();
    },
    [setFilters, onFilterChange],
  );

  const setTlds = useCallback(
    (values: string[]) => {
      setFilters({ tlds: values.length > 0 ? values : null, domainId: null });
      onFilterChange?.();
    },
    [setFilters, onFilterChange],
  );

  const setProviders = useCallback(
    (values: string[]) => {
      setFilters({
        providers: values.length > 0 ? values : null,
        domainId: null,
      });
      onFilterChange?.();
    },
    [setFilters, onFilterChange],
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
    onFilterChange?.();
  }, [setFilters, onFilterChange]);

  // Quick filter for health summary clicks
  const applyHealthFilter = useCallback(
    (filter: HealthFilter | "pending") => {
      if (filter === "pending") {
        setFilters({ status: ["pending"], health: null, domainId: null });
      } else {
        setFilters({ status: null, health: [filter], domainId: null });
      }
      onFilterChange?.();
    },
    [setFilters, onFilterChange],
  );

  // Clear just the domainId filter (for notification deep link chip removal)
  const clearDomainId = useCallback(() => {
    setFilters({ domainId: null });
    onFilterChange?.();
  }, [setFilters, onFilterChange]);

  // Get the domain name for the filtered domain ID (for chip display)
  const filteredDomainName = activeFilters.domainId
    ? (domains.find((d) => d.id === activeFilters.domainId)?.domainName ?? null)
    : null;

  return {
    // Current filter values
    search: activeFilters.search,
    status: activeFilters.status as StatusFilter[],
    health: activeFilters.health as HealthFilter[],
    tlds: activeFilters.tlds,
    providers: activeFilters.providers,
    domainId: activeFilters.domainId,
    filteredDomainName,

    // Setters
    setSearch,
    setStatus,
    setHealth,
    setTlds,
    setProviders,
    clearFilters,
    applyHealthFilter,
    clearDomainId,

    // Computed values
    filteredDomains,
    availableTlds,
    availableProviders,
    hasActiveFilters,
    stats,
  };
}
