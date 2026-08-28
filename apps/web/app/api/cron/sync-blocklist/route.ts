import { NextResponse } from "next/server";

import { syncBlockedDomains } from "@domainstack/db/queries";
import { getBlocklistSources } from "@domainstack/edge-config";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "cron/sync-blocklist" });

/**
 * Cron job to sync the screenshot blocklist from external sources.
 *
 * Fetches blocklist URLs from Edge Config, downloads each list,
 * parses domains, and syncs to the blocked_domains table.
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
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
        const response = await fetch(sourceUrl, { cache: "no-store" });

        if (!response.ok) {
          logger.warn({ sourceUrl, status: response.status }, "Failed to fetch blocklist");
          return [];
        }

        const text = await response.text();
        const domains: string[] = [];

        // Parse domains from blocklist format
        // OISD uses wildcard format: *.example.com or example.com
        let start = 0;
        const len = text.length;

        while (start < len) {
          let end = text.indexOf("\n", start);
          if (end === -1) end = len;

          let tStart = start;
          let tEnd = end - 1;

          // Fast trim spaces and carriage returns
          while (tStart <= tEnd && text.charCodeAt(tStart) <= 32) tStart++;
          while (tEnd >= tStart && text.charCodeAt(tEnd) <= 32) tEnd--;

          start = end + 1;

          if (tStart > tEnd || text.charCodeAt(tStart) === 35) continue; // Empty line or '#' comment

          // Remove "*." prefix
          if (
            tEnd - tStart >= 1 &&
            text.charCodeAt(tStart) === 42 &&
            text.charCodeAt(tStart + 1) === 46
          ) {
            tStart += 2;
          }

          const dLen = tEnd - tStart + 1;
          // Length check and check for leading/trailing dot
          if (
            dLen > 253 ||
            dLen < 3 ||
            text.charCodeAt(tStart) === 46 ||
            text.charCodeAt(tEnd) === 46
          ) {
            continue;
          }

          let hasDot = false;
          let valid = true;
          for (let i = tStart + 1; i < tEnd; i++) {
            const c = text.charCodeAt(i);
            if (c === 46) hasDot = true;
            else if (c <= 32) {
              valid = false;
              break;
            }
          }

          if (valid && hasDot) {
            domains.push(text.slice(tStart, tEnd + 1).toLowerCase());
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
        logger.error({ err: result.reason, sourceUrl: sources[i] }, "Error fetching blocklist");
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
    return NextResponse.json({ error: "Failed to sync blocklist" }, { status: 500 });
  }
}
