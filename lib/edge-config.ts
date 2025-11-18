"use cache";

import { get } from "@vercel/edge-config";
import type { ServiceLimits } from "@/lib/ratelimit";

/**
 * Fetches rate limits from Vercel Edge Config.
 *
 * FAILS OPEN: Returns null if Edge Config is not configured or fails,
 * completely disabling rate limiting for maximum availability.
 *
 * Edge Config key: `rate_limits`
 *
 * Expected schema (duration in milliseconds):
 * ```json
 * {
 *   "rate_limits": {
 *     "dns": { "limit": 60, "duration": 60000 },
 *     "headers": { "limit": 60, "duration": 60000 },
 *     "certs": { "limit": 30, "duration": 60000 },
 *     "registration": { "limit": 10, "duration": 60000 },
 *     "screenshot": { "limit": 30, "duration": 3600000 },
 *     "favicon": { "limit": 100, "duration": 60000 },
 *     "seo": { "limit": 30, "duration": 60000 },
 *     "hosting": { "limit": 30, "duration": 60000 },
 *     "pricing": { "limit": 30, "duration": 60000 }
 *   }
 * }
 * ```
 *
 * @returns Service rate limits or null if unavailable (fail open)
 */
export async function getRateLimits(): Promise<ServiceLimits | null> {
  // If EDGE_CONFIG is not set, fail open
  if (!process.env.EDGE_CONFIG) {
    return null;
  }

  try {
    const limits = await get<ServiceLimits>("rate_limits");

    // Return limits if they exist, otherwise null (fail open)
    return limits ?? null;
  } catch (error) {
    // Log the error but fail open (no limits enforced)
    console.warn(
      "[edge-config] failed to fetch rate limits, failing open (no limits)",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

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
  } catch (error) {
    // Log the error but fail gracefully
    console.error(
      "[edge-config] failed to fetch domain suggestions",
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}
