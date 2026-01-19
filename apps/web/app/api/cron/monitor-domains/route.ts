import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  getMonitoredSnapshotIds,
  getVerifiedDomainsWithoutSnapshots,
} from "@/lib/db/repos/snapshots";
import { createLogger } from "@/lib/logger/server";
import { withConcurrencyHandling } from "@/lib/workflow/concurrency";
import { detectChangesWorkflow } from "@/workflows/detect-changes";
import { createBaselineWorkflow } from "@/workflows/initialize-snapshot";

const logger = createLogger({ source: "cron/monitor-domains" });

// Process domains in batches (smaller batch for monitoring due to heavier workload)
const BATCH_SIZE = 25;

/**
 * Cron job to monitor tracked domains for changes.
 *
 * This job handles two tasks:
 * 1. Create baseline snapshots for newly verified domains (from auto-verify)
 * 2. Detect changes for domains that already have snapshots
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

    // Phase 1: Create baseline snapshots for verified domains without snapshots
    const baselineResults = await createBaselineSnapshots();

    // Phase 2: Detect changes for domains with existing snapshots
    const monitorResults = await monitorExistingDomains();

    const result = {
      baselines: baselineResults,
      monitoring: monitorResults,
    };

    logger.info(result, "Monitor domains completed");

    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "Monitor domains failed");
    return NextResponse.json(
      { error: "Failed to monitor domains" },
      { status: 500 },
    );
  }
}

/**
 * Create baseline snapshots for verified domains that don't have one yet.
 * These are typically domains verified by the auto-verify workflow.
 */
async function createBaselineSnapshots(): Promise<{
  scheduled: number;
  successful: number;
  failed: number;
}> {
  const domainsWithoutSnapshots = await getVerifiedDomainsWithoutSnapshots();

  if (domainsWithoutSnapshots.length === 0) {
    return { scheduled: 0, successful: 0, failed: 0 };
  }

  logger.info(
    { count: domainsWithoutSnapshots.length },
    "Creating baseline snapshots for verified domains",
  );

  const results: { id: string; success: boolean }[] = [];

  for (let i = 0; i < domainsWithoutSnapshots.length; i += BATCH_SIZE) {
    const batch = domainsWithoutSnapshots.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async ({ trackedDomainId, domainId }) => {
        try {
          const run = await start(createBaselineWorkflow, [
            { trackedDomainId, domainId },
          ]);
          await withConcurrencyHandling(run.returnValue, {
            trackedDomainId,
            workflow: "initialize-snapshot",
          });
          return { id: trackedDomainId, success: true };
        } catch (err) {
          logger.error(
            { trackedDomainId, err },
            "Failed to create baseline snapshot",
          );
          return { id: trackedDomainId, success: false };
        }
      }),
    );

    results.push(...batchResults);
  }

  return {
    scheduled: domainsWithoutSnapshots.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}

/**
 * Detect changes for domains that already have baseline snapshots.
 */
async function monitorExistingDomains(): Promise<{
  scheduled: number;
  successful: number;
  failed: number;
}> {
  const trackedDomainIds = await getMonitoredSnapshotIds();

  if (trackedDomainIds.length === 0) {
    return { scheduled: 0, successful: 0, failed: 0 };
  }

  const results: { id: string; success: boolean }[] = [];

  for (let i = 0; i < trackedDomainIds.length; i += BATCH_SIZE) {
    const batch = trackedDomainIds.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (id) => {
        try {
          const run = await start(detectChangesWorkflow, [
            { trackedDomainId: id },
          ]);
          await withConcurrencyHandling(run.returnValue, {
            trackedDomainId: id,
            workflow: "detect-changes",
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

  return {
    scheduled: trackedDomainIds.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
}
