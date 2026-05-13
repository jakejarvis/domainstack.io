import type { PortfolioDomain, PortfolioStatusFilter } from "@/lib/portfolio";
import type { HealthBucket } from "@/lib/stores/portfolio-store";
import { EXPIRING_SOON_DAYS } from "@domainstack/constants";

export const HEALTH_OPTIONS: Array<{ value: HealthBucket; label: string }> = [
  { label: "Healthy", value: "healthy" },
  { label: "Expiring soon", value: "expiring" },
  { label: "Expired", value: "expired" },
];

export const STATUS_OPTIONS: Array<{ value: PortfolioStatusFilter; label: string }> = [
  { label: "All", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Needs verification", value: "needs-verification" },
  { label: "Muted", value: "muted" },
];

const HEALTH_LABELS: Record<HealthBucket, string> = HEALTH_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<HealthBucket, string>,
);

const STATUS_LABELS: Record<PortfolioStatusFilter, string> = STATUS_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<PortfolioStatusFilter, string>,
);

export interface PortfolioFilters {
  status: PortfolioStatusFilter;
  health: HealthBucket[];
  tlds: string[];
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function healthBucketFor(
  expirationDate: Date | string | null | undefined,
  verified: boolean,
  now: number = Date.now(),
): HealthBucket | null {
  if (!verified) return null;
  const date = toDate(expirationDate);
  if (!date) return null;
  const daysUntilExpiry = Math.ceil((date.getTime() - now) / 86_400_000);
  if (daysUntilExpiry <= 0) return "expired";
  if (daysUntilExpiry <= EXPIRING_SOON_DAYS) return "expiring";
  return "healthy";
}

export function tldFor(domainName: string): string {
  const parts = domainName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

function matchesStatus(domain: PortfolioDomain, status: PortfolioStatusFilter): boolean {
  switch (status) {
    case "all":
      return true;
    case "verified":
      return domain.verified;
    case "needs-verification":
      return !domain.verified;
    case "muted":
      return domain.muted;
  }
}

export function applyFilters(
  domains: PortfolioDomain[],
  filters: PortfolioFilters,
  query: string,
  now: number = Date.now(),
): PortfolioDomain[] {
  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;
  const hasHealth = filters.health.length > 0;
  const hasTlds = filters.tlds.length > 0;

  return domains.filter((domain) => {
    if (hasQuery && !domain.domainName.toLowerCase().includes(normalizedQuery)) {
      return false;
    }
    if (!matchesStatus(domain, filters.status)) {
      return false;
    }
    if (hasHealth) {
      const bucket = healthBucketFor(domain.expirationDate, domain.verified, now);
      if (!bucket || !filters.health.includes(bucket)) return false;
    }
    if (hasTlds && !filters.tlds.includes(tldFor(domain.domainName))) {
      return false;
    }
    return true;
  });
}

export function availableTldsFrom(domains: PortfolioDomain[]): string[] {
  const set = new Set<string>();
  for (const domain of domains) {
    const tld = tldFor(domain.domainName);
    if (tld) set.add(tld);
  }
  return Array.from(set).sort();
}

export type FilterChip = {
  key: string;
  label: string;
  remove: () => void;
};

export function buildChips(
  filters: PortfolioFilters,
  actions: {
    setStatus: (status: PortfolioStatusFilter) => void;
    toggleHealth: (bucket: HealthBucket) => void;
    toggleTld: (tld: string) => void;
  },
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.status !== "all") {
    chips.push({
      key: `status:${filters.status}`,
      label: STATUS_LABELS[filters.status],
      remove: () => actions.setStatus("all"),
    });
  }
  for (const bucket of filters.health) {
    chips.push({
      key: `health:${bucket}`,
      label: HEALTH_LABELS[bucket],
      remove: () => actions.toggleHealth(bucket),
    });
  }
  for (const tld of filters.tlds) {
    chips.push({
      key: `tld:${tld}`,
      label: `.${tld}`,
      remove: () => actions.toggleTld(tld),
    });
  }
  return chips;
}

export function hasActiveFilters(filters: PortfolioFilters): boolean {
  return filters.status !== "all" || filters.health.length > 0 || filters.tlds.length > 0;
}

export function activeFilterCount(filters: PortfolioFilters): number {
  return (filters.status !== "all" ? 1 : 0) + filters.health.length + filters.tlds.length;
}
