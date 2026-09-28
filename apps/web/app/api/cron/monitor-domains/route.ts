import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { settleInBatches, startInBatches } from "@/lib/batch";
import { isCronAuthorized } from "@/lib/cron";
import {
  getMonitoredSnapshotIds,
  getVerifiedDomainsWithoutSnapshots,
} from "@domainstack/db/queries/snapshots";
import { createLogger } from "@domainstack/logger";
import { detectChangesWorkflow } from "@domainstack/workflows/detect-changes";
import { initializeSnapshotWorkflow } from "@domainstack/workflows/initialize-snapshot";
import { acquireMonitorLock, releaseMonitorLock } from "@domainstack/workflows/monitor-lock";

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
  if (!isCronAuthorized(request)) {
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

    const baselines = await startInBatches(
      domains,
      START_BATCH_SIZE,
      (input) => start(initializeSnapshotWorkflow, [input]),
      logger,
    );

    // A per-domain lock prevents starting a duplicate run while a prior run
    // (e.g. stuck in retry backoff) for the same domain is still in-flight.
    // A held lock (null token) is a skip; a rejected acquisition is a failure.
    const lockResults = await settleInBatches(ids, START_BATCH_SIZE, async (id) => ({
      id,
      ownerToken: await acquireMonitorLock(id),
    }));
    const lockFailures = lockResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (lockFailures.length > 0) {
      logger.warn(
        { failed: lockFailures.length, total: ids.length, err: lockFailures[0].reason },
        "Some monitor lock acquisitions failed",
      );
    }
    let skippedInFlight = 0;
    const monitorsToStart = lockResults.flatMap((result) => {
      if (result.status === "rejected") return [];
      if (!result.value.ownerToken) {
        skippedInFlight++;
        return [];
      }
      return [{ id: result.value.id, ownerToken: result.value.ownerToken }];
    });
    const monitoring = await startInBatches(
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
      logger,
    );

    const result = {
      baselines: {
        started: baselines.started,
        failed: baselines.failed,
        total: domains.length,
      },
      monitoring: {
        started: monitoring.started,
        failed: monitoring.failed + lockFailures.length,
        lockFailed: lockFailures.length,
        total: ids.length,
        skippedInFlight,
      },
    };
    const hasFailures = result.baselines.failed > 0 || result.monitoring.failed > 0;

    logger.info(result, "Monitor domains completed");
    return NextResponse.json(result, { status: hasFailures ? 500 : 200 });
  } catch (err) {
    logger.error({ err }, "Monitor domains failed");
    return NextResponse.json({ error: "Failed to monitor domains" }, { status: 500 });
  }
}
