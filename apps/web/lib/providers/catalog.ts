import type { ProviderCategory } from "@/lib/constants/providers";
import { getProviderCatalog } from "@/lib/edge-config";
import { getProvidersFromCatalog, type Provider } from "./parser";

/**
 * Get providers for a specific category from Edge Config.
 *
 * Returns an empty array if Edge Config is unavailable or invalid,
 * which causes all detections to return "unknown provider" (graceful degradation).
 *
 * @param category - The provider category to fetch
 * @returns Array of providers for the category, empty if unavailable
 */
export async function getProviders(
  category: ProviderCategory,
): Promise<Provider[]> {
  const catalog = await getProviderCatalog();

  if (!catalog) {
    return [];
  }

  return getProvidersFromCatalog(catalog, category);
}
