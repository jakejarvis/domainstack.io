"use client";

import { parseAsArrayOf, parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";
import { EXPIRING_SOON_DAYS } from "@/lib/constants";

// Filter types
export type StatusFilter = "verified" | "pending";
export type HealthFilter = "healthy" | "expiring" | "expired";

/**
 * Extract TLD from domain name (e.g., "example.com" -> ".com")
 */
function extractTld(domain: string): string {
  const parts = domain.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
}

/**
 * Determine health status based on expiration date
 */
function getHealthStatus(
  expirationDate: Date | null,
  verified: boolean,
): HealthFilter | null {
  if (!verified || !expirationDate) return null;

  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry <= 0) return "expired";
  if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return "expiring";
  return "healthy";
}

/**
 * Hook for managing domain filter state with URL persistence using nuqs.
 */
export function useDomainFilters(domains: TrackedDomainWithDetails[]) {
  // URL state with nuqs
  const [filters, setFilters] = useQueryStates(
    {
      search: parseAsString.withDefault(""),
      status: parseAsArrayOf(parseAsString).withDefault([]),
      health: parseAsArrayOf(parseAsString).withDefault([]),
      tlds: parseAsArrayOf(parseAsString).withDefault([]),
    },
    {
      shallow: true, // Don't trigger server re-render
      clearOnDefault: true, // Keep URL clean
    },
  );

  // Extract unique TLDs from domains for the dropdown
  const availableTlds = useMemo(() => {
    const tldSet = new Set<string>();
    for (const domain of domains) {
      const tld = extractTld(domain.domainName);
      if (tld) tldSet.add(tld);
    }
    return Array.from(tldSet).sort();
  }, [domains]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.search.length > 0 ||
    filters.status.length > 0 ||
    filters.health.length > 0 ||
    filters.tlds.length > 0;

  // Filter domains based on current filters
  const filteredDomains = useMemo(() => {
    return domains.filter((domain) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!domain.domainName.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (filters.status.length > 0) {
        const domainStatus = domain.verified ? "verified" : "pending";
        if (!filters.status.includes(domainStatus)) {
          return false;
        }
      }

      // Health filter
      if (filters.health.length > 0) {
        const healthStatus = getHealthStatus(
          domain.expirationDate,
          domain.verified,
        );
        // If domain has no health status (unverified), only show if no health filter
        if (!healthStatus || !filters.health.includes(healthStatus)) {
          return false;
        }
      }

      // TLD filter
      if (filters.tlds.length > 0) {
        const tld = extractTld(domain.domainName);
        if (!filters.tlds.includes(tld)) {
          return false;
        }
      }

      return true;
    });
  }, [domains, filters]);

  // Compute stats for health summary
  const stats = useMemo(() => {
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
      );
      if (healthStatus === "expiring" || healthStatus === "expired") {
        expiringSoon++;
      }
    }

    return { expiringSoon, pendingVerification };
  }, [domains]);

  // Filter setters
  const setSearch = (value: string) => setFilters({ search: value || null });

  const setStatus = (values: StatusFilter[]) =>
    setFilters({ status: values.length > 0 ? values : null });

  const setHealth = (values: HealthFilter[]) =>
    setFilters({ health: values.length > 0 ? values : null });

  const setTlds = (values: string[]) =>
    setFilters({ tlds: values.length > 0 ? values : null });

  const clearFilters = () =>
    setFilters({ search: null, status: null, health: null, tlds: null });

  // Quick filter for health summary clicks
  const applyHealthFilter = (filter: HealthFilter | "pending") => {
    if (filter === "pending") {
      setFilters({ status: ["pending"], health: null });
    } else {
      setFilters({ status: null, health: [filter] });
    }
  };

  return {
    // Current filter values
    search: filters.search,
    status: filters.status as StatusFilter[],
    health: filters.health as HealthFilter[],
    tlds: filters.tlds,

    // Setters
    setSearch,
    setStatus,
    setHealth,
    setTlds,
    clearFilters,
    applyHealthFilter,

    // Computed values
    filteredDomains,
    availableTlds,
    hasActiveFilters,
    stats,
  };
}
