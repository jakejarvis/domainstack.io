import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getMonitoredSnapshotIds } from "@/lib/db/repos/snapshots";
import { createLogger } from "@/lib/logger/server";
import { withConcurrencyHandling } from "@/lib/workflow";
import { monitorDomainWorkflow } from "@/workflows/monitor-domain";

const logger = createLogger({ source: "cron/monitor-domains" });

// Process domains in batches (smaller batch for monitoring due to heavier workload)
const BATCH_SIZE = 25;

/**
 * Cron job to monitor tracked domains for changes.
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
    logger.info("Starting monitor domains cron job");

    const trackedDomainIds = await getMonitoredSnapshotIds();

    if (trackedDomainIds.length === 0) {
      logger.info("No domains to monitor");
      return NextResponse.json({ scheduled: 0, successful: 0, failed: 0 });
    }

    const results: { id: string; success: boolean }[] = [];

    // Process in batches
    for (let i = 0; i < trackedDomainIds.length; i += BATCH_SIZE) {
      const batch = trackedDomainIds.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (id) => {
          try {
            const run = await start(monitorDomainWorkflow, [
              { trackedDomainId: id },
            ]);
            // Handle concurrency conflicts gracefully (returns undefined if another worker handled it)
            await withConcurrencyHandling(run.returnValue, {
              trackedDomainId: id,
              workflow: "monitor-domain",
            });
            return { id, success: true };
          } catch (err) {
            logger.error(
              { trackedDomainId: id, err },
              "Failed to run monitor domain workflow",
            );
            return { id, success: false };
          }
        }),
      );

      results.push(...batchResults);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info(
      { scheduled: trackedDomainIds.length, successful, failed },
      "Monitor domains completed",
    );

    return NextResponse.json({
      scheduled: trackedDomainIds.length,
      successful,
      failed,
    });
  } catch (err) {
    logger.error({ err }, "Monitor domains failed");
    return NextResponse.json(
      { error: "Failed to monitor domains" },
      { status: 500 },
    );
  }
}
