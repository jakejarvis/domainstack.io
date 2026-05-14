import type { ProviderInfo } from "@domainstack/types";

export type PortfolioStatusFilter = "all" | "verified" | "needs-verification" | "muted";
export type PortfolioSort = "name" | "expiry" | "created";

export type PortfolioDomain = {
  id: string;
  domainName: string;
  verified: boolean;
  muted: boolean;
  createdAt: Date | string;
  expirationDate: Date | string | null;
  archivedAt?: Date | string | null;
  registrar: ProviderInfo | null;
  dns: ProviderInfo | null;
  hosting: ProviderInfo | null;
  email: ProviderInfo | null;
  ca: ProviderInfo | null;
};

function time(value: Date | string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function filterPortfolioDomains(
  domains: PortfolioDomain[],
  filter: PortfolioStatusFilter,
  query: string,
): PortfolioDomain[] {
  const normalizedQuery = query.trim().toLowerCase();

  return domains.filter((domain) => {
    const matchesQuery =
      !normalizedQuery || domain.domainName.toLowerCase().includes(normalizedQuery);
    if (!matchesQuery) return false;

    switch (filter) {
      case "verified":
        return domain.verified;
      case "needs-verification":
        return !domain.verified;
      case "muted":
        return domain.muted;
      case "all":
        return true;
    }
  });
}

export function sortPortfolioDomains(
  domains: PortfolioDomain[],
  sort: PortfolioSort,
): PortfolioDomain[] {
  return domains.toSorted((a, b) => {
    switch (sort) {
      case "expiry":
        return time(a.expirationDate) - time(b.expirationDate);
      case "created":
        return time(b.createdAt) - time(a.createdAt);
      case "name":
        return a.domainName.localeCompare(b.domainName);
    }
  });
}
