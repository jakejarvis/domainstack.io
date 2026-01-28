import { subDays } from "date-fns";
import { NextResponse } from "next/server";
import { trackedDomainsRepo } from "@/lib/db/repos";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "cron/cleanup-stale-domains" });

// Domains that remain unverified after this many days will be deleted
const STALE_DOMAIN_DAYS = 30;

// Maximum number of IDs to delete in a single batch to avoid huge IN clauses
const DELETE_BATCH_SIZE = 500;

/**
 * Cron job to clean up stale unverified domains.
 *
 * Domains that have been added but never verified for more than 30 days
 * are deleted to prevent database bloat.
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
    logger.info("Starting cleanup stale domains cron job");

    const cutoffDate = subDays(new Date(), STALE_DOMAIN_DAYS);
    const staleDomains =
      await trackedDomainsRepo.getStaleUnverifiedDomains(cutoffDate);

    if (staleDomains.length === 0) {
      logger.info("No stale domains to cleanup");
      return NextResponse.json({
        total: 0,
        deleted: 0,
        cutoffDate: cutoffDate.toISOString(),
      });
    }

    const ids = staleDomains.map((d) => d.id);

    // Delete in batches to avoid huge IN clauses
    let deletedCount = 0;
    for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
      const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
      const batchDeleted =
        await trackedDomainsRepo.deleteStaleUnverifiedDomains(batch);
      deletedCount += batchDeleted;
    }

    logger.info(
      { total: staleDomains.length, deleted: deletedCount },
      "Cleanup stale domains completed",
    );

    return NextResponse.json({
      total: staleDomains.length,
      deleted: deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Cleanup stale domains failed");
    return NextResponse.json(
      { error: "Failed to cleanup stale domains" },
      { status: 500 },
    );
  }
}
