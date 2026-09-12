/**
 * Vercel Edge Config utilities.
 *
 * Provides cached access to configuration stored in Vercel Edge Config.
 * Uses React's cache() for request-level deduplication.
 */

import { get } from "@vercel/edge-config";
import { cache } from "react";

import { createLogger } from "@domainstack/logger";
import { type ProviderCatalog, safeParseProviderCatalog } from "@domainstack/utils/providers";

const logger = createLogger({ source: "edge-config" });

/**
 * Fetches the provider catalog from Vercel Edge Config.
 *
 * Returns null if Edge Config is not configured, the key doesn't exist,
 * or validation fails (graceful degradation - all detections become "unknown").
 *
 * Edge Config key: `provider_catalog`
 *
 * @returns Validated ProviderCatalog or null if unavailable/invalid
 */
export const getProviderCatalog = cache(async (): Promise<ProviderCatalog | null> => {
  if (!process.env.EDGE_CONFIG) {
    return null;
  }

  try {
    const raw = await get<unknown>("provider_catalog");

    if (!raw) {
      logger.warn("provider_catalog key not found in Edge Config");
      return null;
    }

    const result = safeParseProviderCatalog(raw);

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
