import { cache } from "react";
import { getProviderCatalog } from "@/lib/edge-config";
import type { ProviderCategory } from "@/lib/types";
import { getProvidersFromCatalog, type Provider } from "./parser";

/**
 * Cached fetch of the provider catalog from Edge Config.
 *
 * Uses React cache() for request-level deduplication - multiple calls
 * within the same request will only fetch from Edge Config once.
 */
const getCachedCatalog = cache(async () => {
  return getProviderCatalog();
});

/**
 * Get providers for a specific category from Edge Config.
 *
 * Returns an empty array if Edge Config is unavailable or invalid,
 * which causes all detections to return "unknown provider" (graceful degradation).
 *
 * Uses React cache() for request-level deduplication.
 *
 * @param category - The provider category to fetch
 * @returns Array of providers for the category, empty if unavailable
 */
export async function getProviders(
  category: ProviderCategory,
): Promise<Provider[]> {
  const catalog = await getCachedCatalog();

  if (!catalog) {
    return [];
  }

  return getProvidersFromCatalog(catalog, category);
}

/**
 * Get all providers from all categories from Edge Config.
 *
 * Useful for bulk operations or when multiple categories are needed.
 *
 * @returns Record of category to providers array
 */
export async function getAllProviders(): Promise<
  Record<ProviderCategory, Provider[]>
> {
  const catalog = await getCachedCatalog();

  if (!catalog) {
    return {
      ca: [],
      dns: [],
      email: [],
      hosting: [],
      registrar: [],
    };
  }

  return {
    ca: getProvidersFromCatalog(catalog, "ca"),
    dns: getProvidersFromCatalog(catalog, "dns"),
    email: getProvidersFromCatalog(catalog, "email"),
    hosting: getProvidersFromCatalog(catalog, "hosting"),
    registrar: getProvidersFromCatalog(catalog, "registrar"),
  };
}
