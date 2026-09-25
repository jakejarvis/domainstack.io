import { NextResponse } from "next/server";

import { parseBlocklist } from "@/lib/blocklist";
import { isCronAuthorized } from "@/lib/cron";
import { blocklistSources } from "@/lib/flags";
import { syncBlockedDomains } from "@domainstack/db/queries/blocked-domains";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "cron/sync-blocklist" });

/**
 * Cron job to sync the screenshot blocklist from external sources.
 *
 * Fetches blocklist URLs from the `blocklist-sources` flag, downloads each list,
 * parses domains, and syncs to the blocked_domains table.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting sync blocklist cron job");

    const sources = await blocklistSources();

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
        const response = await fetch(sourceUrl, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Failed to fetch blocklist: HTTP ${response.status}`);
        }

        const domains = parseBlocklist(await response.text());
        logger.info({ sourceUrl, count: domains.length }, "Parsed blocklist");
        return domains;
      }),
    );

    const failedSources = fetchResults.flatMap((result, i) =>
      result.status === "rejected" ? [{ sourceUrl: sources[i], err: result.reason }] : [],
    );

    if (failedSources.length > 0) {
      // A partial download is not the desired state: syncing it would delete every
      // domain unique to the failed source. Keep last week's list and retry next run.
      for (const { sourceUrl, err } of failedSources) {
        logger.warn({ err, sourceUrl }, "Blocklist source failed; skipping sync");
      }
      return NextResponse.json(
        {
          sources: sources.length,
          failed: failedSources.length,
          added: 0,
          removed: 0,
          skipped: true,
        },
        { status: 502 },
      );
    }

    const allDomains = fetchResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );

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
    return NextResponse.json({ error: "Failed to sync blocklist" }, { status: 500 });
  }
}
