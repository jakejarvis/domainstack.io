/**
 * Vercel Edge Config utilities.
 *
 * Provides cached access to configuration stored in Vercel Edge Config.
 * Uses React's cache() for request-level deduplication.
 */

import { get } from "@vercel/edge-config";
import { cache } from "react";

import { createLogger } from "@domainstack/logger";

import { type ProviderCatalog, ProviderCatalogSchema } from "./providers";
import { type TechnologyCatalog, TechnologyCatalogSchema } from "./technologies";

const logger = createLogger({ source: "catalog" });

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

/**
 * Fetches the technology catalog from Vercel Edge Config.
 *
 * Returns null if Edge Config is not configured, the key doesn't exist, or
 * validation fails. Callers degrade to reporting no technologies rather than
 * failing the section — a missing catalog is a soft miss, not an error.
 *
 * Edge Config key: `technology_catalog`
 */
export const getTechnologyCatalog = cache(async (): Promise<TechnologyCatalog | null> => {
  if (!process.env.EDGE_CONFIG) {
    return null;
  }

  try {
    const raw = await get<unknown>("technology_catalog");

    if (!raw) {
      logger.warn("technology_catalog key not found in Edge Config");
      return null;
    }

    const result = TechnologyCatalogSchema.safeParse(raw);

    if (!result.success) {
      logger.error(result.error, "failed to parse technology catalog");
      return null;
    }

    return result.data;
  } catch (err) {
    logger.warn(err, "failed to fetch technology catalog");
    return null;
  }
});
