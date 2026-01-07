/**
 * Stats types - Plain TypeScript interfaces.
 *
 * These are internal data structures for platform statistics,
 * no runtime validation needed.
 */

/**
 * Provider stats breakdown.
 */
export interface ProviderStats {
  id: string;
  name: string;
  slug: string;
  count: number;
}

/**
 * TLD distribution stats.
 */
export interface TldStats {
  tld: string;
  count: number;
}

/**
 * Growth metrics (recent domain activity).
 */
export interface GrowthStats {
  /** Domains added in the last 24 hours */
  domainsLast24h: number;
  /** Domains added in the last 7 days */
  domainsLast7d: number;
  /** Domains added in the last 30 days */
  domainsLast30d: number;
}

/**
 * Provider stats by category.
 */
export interface ProviderStatsByCategory {
  hosting: ProviderStats[];
  registrar: ProviderStats[];
  dns: ProviderStats[];
  email: ProviderStats[];
  ca: ProviderStats[];
}

/**
 * Complete platform statistics response.
 */
export interface PlatformStatsResponse {
  /** Total number of unique domains in the database */
  totalUniqueDomains: number;
  /** Top TLDs by usage */
  topTlds: TldStats[];
  /** Top providers by category */
  topProviders: ProviderStatsByCategory;
  /** Recent growth metrics */
  growth: GrowthStats;
  /** Timestamp when stats were generated */
  generatedAt: Date;
}
