import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { settleInBatches } from "@/lib/settle-in-batches";
import { acquireMonitorLock, releaseMonitorLock } from "@/lib/workflow/monitor-dedup";
import { detectChangesWorkflow } from "@/workflows/detect-changes";
import { initializeSnapshotWorkflow } from "@/workflows/initialize-snapshot";
import {
  getMonitoredSnapshotIds,
  getVerifiedDomainsWithoutSnapshots,
} from "@domainstack/db/queries/snapshots";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "cron/monitor-domains" });

/** Max concurrent workflow starts (or lock acquisitions) per invocation. */
const START_BATCH_SIZE = 50;

/**
 * Cron job to monitor tracked domains for changes.
 *
 * This job handles two tasks:
 * 1. Create baseline snapshots for newly verified domains (from auto-verify)
 * 2. Detect changes for domains that already have snapshots
 */
export async function GET(request: Request) {
  if (request.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Phase 1 (baselines) and Phase 2 (change detection) operate on disjoint
    // domain sets, so the lookups can run together, but the workflow starts
    // run in sequence (baselines first) to keep concurrency bounded to
    // START_BATCH_SIZE instead of doubling it.
    const [domains, ids] = await Promise.all([
      getVerifiedDomainsWithoutSnapshots(),
      getMonitoredSnapshotIds(),
    ]);

    const baselineResults = await settleInBatches(domains, START_BATCH_SIZE, (input) =>
      start(initializeSnapshotWorkflow, [input]),
    );
    const baselinesStarted = baselineResults.filter((r) => r.status === "fulfilled").length;
    {
      const failures = baselineResults.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (failures.length > 0) {
        logger.warn(
          { failed: failures.length, total: domains.length, err: failures[0].reason },
          "Some workflow starts failed",
        );
      }
    }

    // A per-domain lock prevents starting a duplicate run while a prior run
    // (e.g. stuck in retry backoff) for the same domain is still in-flight.
    const lockResults = await settleInBatches(ids, START_BATCH_SIZE, async (id) => ({
      id,
      ownerToken: await acquireMonitorLock(id),
    }));
    const monitorsToStart = lockResults.flatMap((result) => {
      if (result.status === "rejected" || !result.value.ownerToken) return [];
      return [{ id: result.value.id, ownerToken: result.value.ownerToken }];
    });
    const monitorResults = await settleInBatches(
      monitorsToStart,
      START_BATCH_SIZE,
      async ({ id, ownerToken }) => {
        try {
          return await start(detectChangesWorkflow, [
            { trackedDomainId: id, monitorLockOwnerToken: ownerToken },
          ]);
        } catch (err) {
          await releaseMonitorLock(id, ownerToken);
          throw err;
        }
      },
    );
    const monitoringStarted = monitorResults.filter((r) => r.status === "fulfilled").length;
    {
      const failures = monitorResults.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (failures.length > 0) {
        logger.warn(
          { failed: failures.length, total: monitorsToStart.length, err: failures[0].reason },
          "Some workflow starts failed",
        );
      }
    }

    const result = {
      baselines: { started: baselinesStarted, total: domains.length },
      monitoring: {
        started: monitoringStarted,
        total: ids.length,
        skippedInFlight: ids.length - monitorsToStart.length,
      },
    };

    logger.info(result, "Monitor domains completed");
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "Monitor domains failed");
    return NextResponse.json({ error: "Failed to monitor domains" }, { status: 500 });
  }
}
