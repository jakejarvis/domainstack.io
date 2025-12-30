import { get } from "@vercel/edge-config";
import { DEFAULT_TIER_LIMITS, type TierLimits } from "@/lib/constants";
import { createLogger } from "@/lib/logger/server";

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
      logger.error("failed to fetch domain suggestions", err);
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
      logger.error("failed to fetch tier limits", err);
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
