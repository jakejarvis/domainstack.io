import { syncBlockedDomains } from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";
import { getBlocklistSources } from "@domainstack/server/edge-config";
import { NextResponse } from "next/server";

const logger = createLogger({ source: "cron/sync-blocklist" });

/**
 * Cron job to sync the screenshot blocklist from external sources.
 *
 * Fetches blocklist URLs from Edge Config, downloads each list,
 * parses domains, and syncs to the blocked_domains table.
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  if (
    request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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

    // Fetch and parse all blocklists in parallel
    const fetchResults = await Promise.allSettled(
      sources.map(async (sourceUrl) => {
        const response = await fetch(sourceUrl);

        if (!response.ok) {
          logger.warn(
            { sourceUrl, status: response.status },
            "Failed to fetch blocklist",
          );
          return [];
        }

        const text = await response.text();
        const lines = text.split("\n");
        const domains: string[] = [];

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
            domains.push(domain.toLowerCase());
          }
        }

        logger.info({ sourceUrl, count: domains.length }, "Parsed blocklist");
        return domains;
      }),
    );

    // Collect all domains from successful fetches
    const allDomains: string[] = [];
    for (let i = 0; i < fetchResults.length; i++) {
      const result = fetchResults[i];
      if (result.status === "fulfilled") {
        allDomains.push(...result.value);
      } else {
        logger.error(
          { err: result.reason, sourceUrl: sources[i] },
          "Error fetching blocklist",
        );
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
