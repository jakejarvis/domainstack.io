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
 *
 * Global Config key: `provider_catalog`
 *
 * @returns Validated ProviderCatalog or null if unavailable/invalid
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
    return null;
  }
});
