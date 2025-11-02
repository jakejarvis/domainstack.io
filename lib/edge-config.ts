"use cache";

import { get } from "@vercel/edge-config";

/**
 * Rate limit configuration for each service.
 */
export type RateLimitConfig = {
  points: number;
  window: `${number} ${"s" | "m" | "h"}`;
};

/**
 * Service rate limits configuration.
 *
 * Each service has a points budget and time window for rate limiting.
 * Example: { points: 60, window: "1 m" } = 60 requests per minute
 */
export type ServiceLimits = {
  dns: RateLimitConfig;
  headers: RateLimitConfig;
  certs: RateLimitConfig;
  registration: RateLimitConfig;
  screenshot: RateLimitConfig;
  favicon: RateLimitConfig;
  seo: RateLimitConfig;
  hosting: RateLimitConfig;
  pricing: RateLimitConfig;
};

/**
 * Fetches rate limits from Vercel Edge Config.
 *
 * FAILS OPEN: Returns null if Edge Config is not configured or fails,
 * completely disabling rate limiting for maximum availability.
 *
 * Edge Config key: `rate_limits`
 *
 * Expected schema:
 * ```json
 * {
 *   "rate_limits": {
 *     "dns": { "points": 60, "window": "1 m" },
 *     "headers": { "points": 60, "window": "1 m" },
 *     "certs": { "points": 30, "window": "1 m" },
 *     "registration": { "points": 10, "window": "1 m" },
 *     "screenshot": { "points": 30, "window": "1 h" },
 *     "favicon": { "points": 100, "window": "1 m" },
 *     "seo": { "points": 30, "window": "1 m" },
 *     "hosting": { "points": 30, "window": "1 m" },
 *     "pricing": { "points": 30, "window": "1 m" }
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
