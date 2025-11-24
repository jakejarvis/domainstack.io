import { get } from "@vercel/edge-config";
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
