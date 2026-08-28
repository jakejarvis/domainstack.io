import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { acquireMonitorLock, releaseMonitorLock } from "@/lib/workflow/monitor-dedup";
import { detectChangesWorkflow } from "@/workflows/detect-changes";
import { initializeSnapshotWorkflow } from "@/workflows/initialize-snapshot";
import {
  getMonitoredSnapshotIds,
  getVerifiedDomainsWithoutSnapshots,
} from "@domainstack/db/queries";
import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "cron/monitor-domains" });

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
    // Phase 1: Create baseline snapshots for verified domains without snapshots
    const domains = await getVerifiedDomainsWithoutSnapshots();
    const baselineResults = await Promise.allSettled(
      domains.map((input) => start(initializeSnapshotWorkflow, [input])),
    );
    const baselinesStarted = baselineResults.filter((r) => r.status === "fulfilled").length;

    // Phase 2: Detect changes for domains with existing snapshots.
    // A per-domain lock prevents starting a duplicate run while a prior run
    // (e.g. stuck in retry backoff) for the same domain is still in-flight.
    const ids = await getMonitoredSnapshotIds();
    const lockResults = await Promise.allSettled(
      ids.map(async (id) => ({ id, ownerToken: await acquireMonitorLock(id) })),
    );
    const monitorsToStart = lockResults.flatMap((result) => {
      if (result.status === "rejected" || !result.value.ownerToken) return [];
      return [{ id: result.value.id, ownerToken: result.value.ownerToken }];
    });
    const monitorResults = await Promise.allSettled(
      monitorsToStart.map(async ({ id, ownerToken }) => {
        try {
          return await start(detectChangesWorkflow, [
            { trackedDomainId: id, monitorLockOwnerToken: ownerToken },
          ]);
        } catch (err) {
          await releaseMonitorLock(id, ownerToken);
          throw err;
        }
      }),
    );
    const monitoringStarted = monitorResults.filter((r) => r.status === "fulfilled").length;

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
