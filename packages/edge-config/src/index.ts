/**
 * Vercel Global Config utilities.
 *
 * Provides cached access to configuration stored in Vercel Global Config.
 * Uses React's cache() for request-level deduplication.
 */

import { get } from "@vercel/global-config";
import { cache } from "react";

import { createLogger } from "@domainstack/logger";
import { type ProviderCatalog, ProviderCatalogSchema } from "@domainstack/utils/providers";

const logger = createLogger({ source: "edge-config" });

/**
 * Fetches the provider catalog from Vercel Global Config.
 *
 * Returns null if Global Config is not configured, the key doesn't exist,
 * or validation fails (graceful degradation - all detections become "unknown").
 * Throws when the catalog could not be fetched.
 *
 * Global Config key: `provider_catalog`
 *
 * @returns Validated ProviderCatalog or null if not configured/missing/invalid
 * @throws Error when the fetch fails (an outage, not a configuration state)
 */
export const getProviderCatalog = cache(async (): Promise<ProviderCatalog | null> => {
  if (!process.env.GLOBAL_CONFIG && !process.env.EDGE_CONFIG) {
    return null;
  }

  try {
    const raw = await get<unknown>("provider_catalog");

    if (!raw) {
      logger.warn("provider_catalog key not found in Global Config");
      return null;
    }

    const result = ProviderCatalogSchema.safeParse(raw);

    if (!result.success) {
      logger.error(result.error, "failed to parse provider catalog");
      return null;
    }

    return result.data;
  } catch (err) {
    logger.warn(err, "failed to fetch provider catalog");
    // An outage, unlike a missing or invalid catalog, is transient. Returning null
    // here would make callers persist provider data computed without the catalog.
    throw new Error("Provider catalog unavailable", { cause: err });
  }
});
