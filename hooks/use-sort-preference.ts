"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrackedDomainWithDetails } from "@/lib/db/repos/tracked-domains";

export type SortOption =
  | "name-asc"
  | "name-desc"
  | "expiry-asc"
  | "expiry-desc"
  | "recent";

export type SortOptionConfig = {
  value: SortOption;
  label: string;
  shortLabel: string;
  direction?: "asc" | "desc";
};

export const SORT_OPTIONS: SortOptionConfig[] = [
  {
    value: "expiry-asc",
    label: "Expiry (Soonest first)",
    shortLabel: "Expiry",
    direction: "asc",
  },
  {
    value: "expiry-desc",
    label: "Expiry (Furthest first)",
    shortLabel: "Expiry",
    direction: "desc",
  },
  {
    value: "name-asc",
    label: "Name (A-Z)",
    shortLabel: "Name",
    direction: "asc",
  },
  {
    value: "name-desc",
    label: "Name (Z-A)",
    shortLabel: "Name",
    direction: "desc",
  },
  { value: "recent", label: "Recently added", shortLabel: "Recent" },
];

const STORAGE_KEY = "dashboard-sort-preference";
const DEFAULT_SORT: SortOption = "expiry-asc";

/**
 * Sort domains based on sort option
 */
export function sortDomains(
  domains: TrackedDomainWithDetails[],
  sortOption: SortOption,
): TrackedDomainWithDetails[] {
  const sorted = [...domains];

  switch (sortOption) {
    case "name-asc":
      sorted.sort((a, b) => a.domainName.localeCompare(b.domainName));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.domainName.localeCompare(a.domainName));
      break;
    case "expiry-asc":
      sorted.sort((a, b) => {
        // Put domains without expiry date at the end
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return a.expirationDate.getTime() - b.expirationDate.getTime();
      });
      break;
    case "expiry-desc":
      sorted.sort((a, b) => {
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return b.expirationDate.getTime() - a.expirationDate.getTime();
      });
      break;
    case "recent":
      sorted.sort((a, b) => {
        // Sort by createdAt descending (most recent first)
        const aTime = a.createdAt?.getTime() ?? 0;
        const bTime = b.createdAt?.getTime() ?? 0;
        return bTime - aTime;
      });
      break;
  }

  return sorted;
}

/**
 * Hook to manage sort preference with localStorage persistence.
 */
export function useSortPreference(): [SortOption, (sort: SortOption) => void] {
  const [sortOption, setSortOptionState] = useState<SortOption>(DEFAULT_SORT);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SORT_OPTIONS.some((o) => o.value === stored)) {
        setSortOptionState(stored as SortOption);
      }
    } catch {
      // localStorage not available
    }
    setIsHydrated(true);
  }, []);

  // Persist preference to localStorage when changed
  const setSortOption = useCallback((sort: SortOption) => {
    setSortOptionState(sort);
    try {
      localStorage.setItem(STORAGE_KEY, sort);
    } catch {
      // localStorage not available
    }
  }, []);

  // Return default during SSR to prevent hydration mismatch
  return [isHydrated ? sortOption : DEFAULT_SORT, setSortOption];
}
