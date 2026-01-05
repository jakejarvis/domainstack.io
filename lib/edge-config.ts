import { get } from "@vercel/edge-config";
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
      logger.info("skipping domain suggestions during prerender");
    } else {
      // Log unexpected errors but still fail gracefully
      logger.error(err, "failed to fetch domain suggestions");
    }

    return [];
  }
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
