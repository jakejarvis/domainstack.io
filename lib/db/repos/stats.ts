import "server-only";

import { count, desc, eq, gt, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  certificates,
  domains,
  hosting,
  providers,
  registrations,
} from "@/lib/db/schema";
import type {
  GrowthStats,
  ProviderStats,
  ProviderStatsByCategory,
  TldStats,
} from "@/lib/schemas";

/**
 * Get total count of unique domains in the database
 */
export async function getTotalUniqueDomains(): Promise<number> {
  const result = await db.select({ count: count() }).from(domains);
  return result[0]?.count ?? 0;
}

/**
 * Get top TLDs by domain count
 */
export async function getTopTlds(limit = 10): Promise<TldStats[]> {
  const result = await db
    .select({
      tld: domains.tld,
      count: count(),
    })
    .from(domains)
    .groupBy(domains.tld)
    .orderBy(desc(count()))
    .limit(limit);

  return result.map((row) => ({
    tld: row.tld,
    count: row.count,
  }));
}

/**
 * Get top providers for a specific category
 */
async function getTopProvidersByCategory(
  category: "hosting" | "registrar" | "dns" | "email" | "ca",
  limit = 5,
): Promise<ProviderStats[]> {
  // Build query based on category - each has different join table/column
  if (category === "hosting") {
    const result = await db
      .select({
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
        count: count(),
      })
      .from(hosting)
      .innerJoin(providers, eq(hosting.hostingProviderId, providers.id))
      .groupBy(providers.id, providers.name, providers.slug)
      .orderBy(desc(count()))
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      count: row.count,
    }));
  }

  if (category === "dns") {
    const result = await db
      .select({
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
        count: count(),
      })
      .from(hosting)
      .innerJoin(providers, eq(hosting.dnsProviderId, providers.id))
      .groupBy(providers.id, providers.name, providers.slug)
      .orderBy(desc(count()))
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      count: row.count,
    }));
  }

  if (category === "email") {
    const result = await db
      .select({
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
        count: count(),
      })
      .from(hosting)
      .innerJoin(providers, eq(hosting.emailProviderId, providers.id))
      .groupBy(providers.id, providers.name, providers.slug)
      .orderBy(desc(count()))
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      count: row.count,
    }));
  }

  if (category === "registrar") {
    const result = await db
      .select({
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
        count: count(),
      })
      .from(registrations)
      .innerJoin(providers, eq(registrations.registrarProviderId, providers.id))
      .groupBy(providers.id, providers.name, providers.slug)
      .orderBy(desc(count()))
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      count: row.count,
    }));
  }

  if (category === "ca") {
    const result = await db
      .select({
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
        count: count(),
      })
      .from(certificates)
      .innerJoin(providers, eq(certificates.caProviderId, providers.id))
      .groupBy(providers.id, providers.name, providers.slug)
      .orderBy(desc(count()))
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      count: row.count,
    }));
  }

  return [];
}

/**
 * Get top providers for all categories
 */
export async function getTopProviders(
  limit = 5,
): Promise<ProviderStatsByCategory> {
  const [hosting, registrar, dns, email, ca] = await Promise.all([
    getTopProvidersByCategory("hosting", limit),
    getTopProvidersByCategory("registrar", limit),
    getTopProvidersByCategory("dns", limit),
    getTopProvidersByCategory("email", limit),
    getTopProvidersByCategory("ca", limit),
  ]);

  return { hosting, registrar, dns, email, ca };
}

/**
 * Get growth stats (recent domain activity)
 *
 * Uses conditional aggregation to compute all time ranges in a single query,
 * reducing 3 sequential table scans to 1.
 */
export async function getGrowthStats(): Promise<GrowthStats> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Single query with conditional aggregation instead of 3 separate queries
  const result = await db
    .select({
      domainsLast24h: sum(
        sql<number>`CASE WHEN ${domains.createdAt} > ${last24h} THEN 1 ELSE 0 END`,
      ),
      domainsLast7d: sum(
        sql<number>`CASE WHEN ${domains.createdAt} > ${last7d} THEN 1 ELSE 0 END`,
      ),
      domainsLast30d: count(),
    })
    .from(domains)
    .where(gt(domains.createdAt, last30d));

  return {
    domainsLast24h: Number(result[0]?.domainsLast24h ?? 0),
    domainsLast7d: Number(result[0]?.domainsLast7d ?? 0),
    domainsLast30d: result[0]?.domainsLast30d ?? 0,
  };
}

/**
 * Get all platform stats in a single call (optimized for single endpoint)
 */
export async function getPlatformStats() {
  const [totalUniqueDomains, topTlds, topProviders, growth] = await Promise.all(
    [
      getTotalUniqueDomains(),
      getTopTlds(10),
      getTopProviders(5),
      getGrowthStats(),
    ],
  );

  return {
    totalUniqueDomains,
    topTlds,
    topProviders,
    growth,
    generatedAt: new Date(),
  };
}
