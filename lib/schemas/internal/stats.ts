import { z } from "zod";

/**
 * Provider stats breakdown
 */
export const ProviderStatsSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  count: z.number(),
});

export type ProviderStats = z.infer<typeof ProviderStatsSchema>;

/**
 * TLD distribution stats
 */
export const TldStatsSchema = z.object({
  tld: z.string(),
  count: z.number(),
});

export type TldStats = z.infer<typeof TldStatsSchema>;

/**
 * Growth metrics (recent domain activity)
 */
export const GrowthStatsSchema = z.object({
  /** Domains added in the last 24 hours */
  domainsLast24h: z.number(),
  /** Domains added in the last 7 days */
  domainsLast7d: z.number(),
  /** Domains added in the last 30 days */
  domainsLast30d: z.number(),
});

export type GrowthStats = z.infer<typeof GrowthStatsSchema>;

/**
 * Provider stats by category
 */
export const ProviderStatsByCategorySchema = z.object({
  hosting: z.array(ProviderStatsSchema),
  registrar: z.array(ProviderStatsSchema),
  dns: z.array(ProviderStatsSchema),
  email: z.array(ProviderStatsSchema),
  ca: z.array(ProviderStatsSchema),
});

export type ProviderStatsByCategory = z.infer<
  typeof ProviderStatsByCategorySchema
>;

/**
 * Complete platform statistics response
 */
export const PlatformStatsResponseSchema = z.object({
  /** Total number of unique domains in the database */
  totalUniqueDomains: z.number(),
  /** Top TLDs by usage */
  topTlds: z.array(TldStatsSchema),
  /** Top providers by category */
  topProviders: ProviderStatsByCategorySchema,
  /** Recent growth metrics */
  growth: GrowthStatsSchema,
  /** Timestamp when stats were generated */
  generatedAt: z.date(),
});

export type PlatformStatsResponse = z.infer<typeof PlatformStatsResponseSchema>;
