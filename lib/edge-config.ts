import { get } from "@vercel/edge-config";
import { DEFAULT_TIER_LIMITS, type TierLimits } from "@/lib/constants";
import { createLogger } from "@/lib/logger/server";
import {
  type ProviderCatalog,
  safeParseProviderCatalog,
} from "@/lib/providers/parser";

const logger = createLogger({ source: "edge-config" });

/**
 * Fetches the default domain suggestions from Vercel Edge Config.
 *
 * Falls back to an empty array if Edge Config is not configured or the key doesn't exist,
 * which shows only user search history without default suggestions.
 *
 * Edge Config key: `domain_suggestions`
 *
 * Expected schema:
 * ```json
 * {
 *   "domain_suggestions": [
 *     "github.com",
 *     "reddit.com",
 *     "wikipedia.org",
 *     "firefox.com",
 *     "jarv.is"
 *   ]
 * }
 * ```
 *
 * @returns Array of suggested domain names (empty array if unavailable)
 */
export async function getDefaultSuggestions(): Promise<string[]> {
  // If EDGE_CONFIG is not set, return empty array
  if (!process.env.EDGE_CONFIG) {
    return [];
  }

  try {
    const suggestions = await get<string[]>("domain_suggestions");

    // Return the suggestions if they exist, otherwise empty array
    return suggestions ?? [];
  } catch (err) {
    // Check for specific prerender error from Next.js/Edge Config
    // "During prerendering, dynamic "use cache" rejects when the prerender is complete."
    const isPrerenderError =
      err instanceof Error && err.message.includes("During prerendering");

    if (isPrerenderError) {
      // This is expected during static generation when accessing dynamic data
      logger.debug("skipping domain suggestions during prerender");
    } else {
      // Log unexpected errors but still fail gracefully
      logger.error(err, "failed to fetch domain suggestions");
    }

    return [];
  }
}

/**
 * Fetches the domain tracking tier limits from Vercel Edge Config.
 *
 * Falls back to DEFAULT_TIER_LIMITS if Edge Config is not configured or the key doesn't exist.
 *
 * Edge Config key: `tier_limits`
 *
 * Expected schema:
 * ```json
 * {
 *   "tier_limits": {
 *     "free": 5,
 *     "pro": 50
 *   }
 * }
 * ```
 *
 * @returns Tier limits object with `free` and `pro` max domain counts
 */
export async function getTierLimits(): Promise<TierLimits> {
  // If EDGE_CONFIG is not set, return defaults
  if (!process.env.EDGE_CONFIG) {
    return DEFAULT_TIER_LIMITS;
  }

  try {
    const limits = await get<TierLimits>("tier_limits");

    // Merge with defaults in case only some values are set
    return {
      free: limits?.free ?? DEFAULT_TIER_LIMITS.free,
      pro: limits?.pro ?? DEFAULT_TIER_LIMITS.pro,
    };
  } catch (err) {
    // Check for specific prerender error from Next.js/Edge Config
    const isPrerenderError =
      err instanceof Error && err.message.includes("During prerendering");

    if (isPrerenderError) {
      logger.debug("skipping tier limits during prerender");
    } else {
      logger.error(err, "failed to fetch tier limits");
    }

    return DEFAULT_TIER_LIMITS;
  }
}

/**
 * Get the max domains allowed for a specific tier.
 * Convenience wrapper around getTierLimits().
 */
export async function getMaxDomainsForTier(
  tier: "free" | "pro",
): Promise<number> {
  const limits = await getTierLimits();
  return limits[tier];
}

/**
 * Fetches the provider catalog from Vercel Edge Config.
 *
 * Returns null if Edge Config is not configured, the key doesn't exist,
 * or validation fails (graceful degradation - all detections become "unknown").
 *
 * Edge Config key: `provider_catalog`
 *
 * Expected schema:
 * ```json
 * {
 *   "provider_catalog": {
 *     "ca": [{ "name": "Let's Encrypt", "domain": "letsencrypt.org", "rule": {...} }],
 *     "dns": [...],
 *     "email": [...],
 *     "hosting": [...],
 *     "registrar": [...]
 *   }
 * }
 * ```
 *
 * @returns Validated ProviderCatalog or null if unavailable/invalid
 */
export async function getProviderCatalog(): Promise<ProviderCatalog | null> {
  // If EDGE_CONFIG is not set, return null
  if (!process.env.EDGE_CONFIG) {
    return null;
  }

  try {
    const raw = await get<unknown>("provider_catalog");

    if (!raw) {
      logger.debug("provider_catalog key not found in Edge Config");
      return null;
    }

    const result = safeParseProviderCatalog(raw);

    if (!result.success) {
      logger.error(result.error, "failed to parse provider catalog");
      return null;
    }

    return result.data;
  } catch (err) {
    // Log unexpected errors but still fail gracefully
    logger.error(err, "failed to fetch provider catalog");
    return null;
  }
}

/**
 * Fetches the screenshot blocklist source URLs from Vercel Edge Config.
 *
 * Returns an empty array if Edge Config is not configured or the key doesn't exist,
 * which disables blocklist syncing (all domains allowed).
 *
 * Edge Config key: `screenshot_blocklist_sources`
 *
 * Expected schema:
 * ```json
 * {
 *   "screenshot_blocklist_sources": [
 *     "https://nsfw.oisd.nl/domainswild"
 *   ]
 * }
 * ```
 *
 * @returns Array of blocklist source URLs (empty array if unavailable)
 */
export async function getBlocklistSources(): Promise<string[]> {
  if (!process.env.EDGE_CONFIG) {
    return [];
  }

  try {
    const sources = await get<string[]>("screenshot_blocklist_sources");
    return sources ?? [];
  } catch (err) {
    // Log unexpected errors but still fail gracefully
    logger.error(err, "failed to fetch screenshot blocklist sources");
    return [];
  }
}
