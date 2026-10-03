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
 * Returns null only when Global Config is not configured (e.g. local dev).
 * Throws when the catalog is unavailable (an outage), missing, or invalid:
 * computing providers without it would rewrite provider ids and trip change alerts.
 *
 * Global Config key: `provider_catalog`
 *
 * @returns Validated ProviderCatalog, or null if Global Config is not configured
 * @throws Error when the fetch fails, or the catalog is missing or invalid
 */
export const getProviderCatalog = cache(async (): Promise<ProviderCatalog | null> => {
  if (!process.env.GLOBAL_CONFIG && !process.env.EDGE_CONFIG) {
    return null;
  }

  let raw: unknown;
  try {
    raw = await get<unknown>("provider_catalog");
  } catch (err) {
    logger.warn(err, "failed to fetch provider catalog");
    // An outage, unlike a missing or invalid catalog, is transient. Returning null
    // here would make callers persist provider data computed without the catalog.
    throw new Error("Provider catalog unavailable", { cause: err });
  }

  // A configured but missing or invalid catalog throws too: computing providers
  // without it rewrites every domain's provider ids, which change monitoring
  // would report to every user as a provider change.
  if (!raw) {
    logger.error("provider_catalog key not found in Global Config");
    throw new Error("Provider catalog missing");
  }

  const result = ProviderCatalogSchema.safeParse(raw);
  if (!result.success) {
    logger.error(result.error, "failed to parse provider catalog");
    throw new Error("Provider catalog invalid", { cause: result.error });
  }

  return result.data;
});
