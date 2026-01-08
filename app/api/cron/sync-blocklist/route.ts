import { NextResponse } from "next/server";
import { syncBlockedDomains } from "@/lib/db/repos/blocked-domains";
import { getBlocklistSources } from "@/lib/edge-config";
import { fetchWithTimeoutAndRetry } from "@/lib/fetch";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "cron/sync-blocklist" });

/**
 * Cron job to sync the screenshot blocklist from external sources.
 * Schedule: Weekly on Sundays at 2:00 AM UTC
 *
 * Fetches blocklist URLs from Edge Config, downloads each list,
 * parses domains, and syncs to the blocked_domains table.
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting sync blocklist cron job");

    const sources = await getBlocklistSources();

    if (sources.length === 0) {
      logger.info("No blocklist sources configured");
      return NextResponse.json({
        sources: 0,
        added: 0,
        removed: 0,
        total: 0,
      });
    }

    // Fetch and parse all blocklists
    const allDomains: string[] = [];

    for (const sourceUrl of sources) {
      try {
        const response = await fetchWithTimeoutAndRetry(
          sourceUrl,
          {},
          { timeoutMs: 30_000, retries: 2 },
        );

        if (!response.ok) {
          logger.warn(
            { sourceUrl, status: response.status },
            "Failed to fetch blocklist",
          );
          continue;
        }

        const text = await response.text();
        const lines = text.split("\n");

        // Parse domains from blocklist format
        // OISD uses wildcard format: *.example.com or example.com
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;

          const domain = trimmed.startsWith("*.") ? trimmed.slice(2) : trimmed;

          if (
            domain?.includes(".") &&
            !domain.includes(" ") &&
            domain.length <= 253 &&
            !domain.startsWith(".") &&
            !domain.endsWith(".")
          ) {
            allDomains.push(domain.toLowerCase());
          }
        }

        logger.info(
          { sourceUrl, count: allDomains.length },
          "Parsed blocklist",
        );
      } catch (err) {
        logger.error({ err, sourceUrl }, "Error fetching blocklist");
      }
    }

    // Deduplicate and sync
    const uniqueDomains = [...new Set(allDomains)];
    const result = await syncBlockedDomains(uniqueDomains);

    logger.info(
      { sources: sources.length, added: result.added, removed: result.removed },
      "Sync blocklist completed",
    );

    return NextResponse.json({
      sources: sources.length,
      added: result.added,
      removed: result.removed,
      total: result.total,
    });
  } catch (err) {
    logger.error({ err }, "Sync blocklist failed");
    return NextResponse.json(
      { error: "Failed to sync blocklist" },
      { status: 500 },
    );
  }
}
