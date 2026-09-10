import { NextResponse } from "next/server";

import { deleteStaleUnverifiedDomainsByCutoff } from "@domainstack/db/queries/tracked-domains";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "cron/cleanup-stale-domains" });

// Domains that remain unverified after this many days will be deleted
const STALE_DOMAIN_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Cron job to clean up stale unverified domains.
 *
 * Domains that have been added but never verified for more than 30 days
 * are deleted to prevent database bloat.
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    logger.info("Starting cleanup stale domains cron job");

    // Absolute rather than calendar days: an hour either side of a clock
    // change is immaterial to a month-long staleness cutoff.
    const cutoffDate = new Date(Date.now() - STALE_DOMAIN_DAYS * MS_PER_DAY);

    // Optimized: Delete directly by cutoff date in a single query
    const deletedCount = await deleteStaleUnverifiedDomainsByCutoff(cutoffDate);

    if (deletedCount === 0) {
      logger.info("No stale domains to cleanup");
      return NextResponse.json({
        total: 0,
        deleted: 0,
        cutoffDate: cutoffDate.toISOString(),
      });
    }

    logger.info({ deleted: deletedCount }, "Cleanup stale domains completed");

    return NextResponse.json({
      total: deletedCount,
      deleted: deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Cleanup stale domains failed");
    return NextResponse.json({ error: "Failed to cleanup stale domains" }, { status: 500 });
  }
}
