import "server-only";

import { syncBlockedDomains } from "@/lib/db/repos/blocked-domains";
import { getBlocklistSources } from "@/lib/edge-config";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { inngest } from "@/lib/inngest/client";

/**
 * Cron job to sync the screenshot blocklist from external sources.
 * Runs weekly on Sundays at 2:00 AM UTC.
 *
 * Fetches blocklist URLs from Edge Config, downloads each list,
 * parses domains, and syncs to the blocked_domains table.
 */
export const syncScreenshotBlocklist = inngest.createFunction(
  {
    id: "sync-screenshot-blocklist",
    retries: 3,
    concurrency: {
      limit: 1,
    },
  },
  // Run every Sunday at 2:00 AM UTC
  { cron: "0 2 * * 0" },
  async ({ step, logger: inngestLogger }) => {
    // Fetch blocklist source URLs from Edge Config
    const sources = await step.run("fetch-sources", async () => {
      return await getBlocklistSources();
    });

    if (sources.length === 0) {
      inngestLogger.info("No blocklist sources configured");
      return {
        sources: 0,
        domains: 0,
      };
    }

    inngestLogger.info(`Fetching ${sources.length} blocklist source(s)`);

    // Fetch and parse all blocklists
    const allDomains: string[] = [];

    for (const [index, sourceUrl] of sources.entries()) {
      const domains = await step.run(`fetch-blocklist-${index}`, async () => {
        try {
          const response = await fetchWithTimeoutAndRetry(
            sourceUrl,
            {},
            { timeoutMs: 30_000, retries: 2 },
          );

          if (!response.ok) {
            inngestLogger.warn(
              `Failed to fetch blocklist from ${sourceUrl}: HTTP ${response.status}`,
            );
            return [];
          }

          const text = await response.text();
          const lines = text.split("\n");

          // Parse domains from blocklist format
          // OISD uses wildcard format: *.example.com or example.com
          const parsed: string[] = [];
          for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith("#")) continue;

            // Strip wildcard prefix if present (*.example.com -> example.com)
            const domain = trimmed.startsWith("*.")
              ? trimmed.slice(2)
              : trimmed;

            // Basic domain validation
            if (
              domain?.includes(".") &&
              !domain.includes(" ") &&
              domain.length <= 253 &&
              !domain.startsWith(".") &&
              !domain.endsWith(".")
            ) {
              parsed.push(domain.toLowerCase());
            }
          }

          inngestLogger.info(
            `Parsed ${parsed.length} domains from ${sourceUrl}`,
          );
          return parsed;
        } catch (err) {
          inngestLogger.error(`Error fetching blocklist from ${sourceUrl}`, {
            error: err instanceof Error ? err.message : String(err),
          });
          return [];
        }
      });

      allDomains.push(...domains);
    }

    // Deduplicate domains
    const uniqueDomains = [...new Set(allDomains)];

    inngestLogger.info(
      `Total unique domains: ${uniqueDomains.length} from ${sources.length} source(s)`,
    );

    // Sync to database
    const result = await step.run("sync-to-database", async () => {
      return await syncBlockedDomains(uniqueDomains);
    });

    return {
      sources: sources.length,
      added: result.added,
      removed: result.removed,
      total: result.total,
    };
  },
);
