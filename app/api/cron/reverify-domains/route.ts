import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  getPendingTrackedDomainIds,
  getVerifiedTrackedDomainIds,
} from "@/lib/db/repos/tracked-domains";
import { createLogger } from "@/lib/logger/server";
import { withConcurrencyHandling } from "@/lib/workflow";
import { reverifyOwnershipWorkflow } from "@/workflows/reverify-ownership";
import { verifyPendingWorkflow } from "@/workflows/verify-pending";

const logger = createLogger({ source: "cron/reverify-domains" });

// Process domains in batches
const BATCH_SIZE = 25;

/**
 * Cron job to verify pending and re-verify existing domains.
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
    logger.info("Starting reverify domains cron job");

    // 1. Process Pending Domains
    const pendingDomainIds = await getPendingTrackedDomainIds();
    const pendingResults: { id: string; success: boolean }[] = [];

    if (pendingDomainIds.length > 0) {
      for (let i = 0; i < pendingDomainIds.length; i += BATCH_SIZE) {
        const batch = pendingDomainIds.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (id) => {
            try {
              const run = await start(verifyPendingWorkflow, [
                { trackedDomainId: id },
              ]);
              // Handle concurrency conflicts gracefully (returns undefined if another worker handled it)
              await withConcurrencyHandling(run.returnValue, {
                trackedDomainId: id,
                workflow: "verify-pending",
              });
              return { id, success: true };
            } catch (err) {
              logger.error(
                { trackedDomainId: id, err },
                "Failed to run verify pending workflow",
              );
              return { id, success: false };
            }
          }),
        );

        pendingResults.push(...batchResults);
      }
    }

    // 2. Process Verified Domains (Re-verification)
    const verifiedDomainIds = await getVerifiedTrackedDomainIds();
    const verifiedResults: { id: string; success: boolean }[] = [];

    if (verifiedDomainIds.length > 0) {
      for (let i = 0; i < verifiedDomainIds.length; i += BATCH_SIZE) {
        const batch = verifiedDomainIds.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (id) => {
            try {
              const run = await start(reverifyOwnershipWorkflow, [
                { trackedDomainId: id },
              ]);
              // Handle concurrency conflicts gracefully (returns undefined if another worker handled it)
              await withConcurrencyHandling(run.returnValue, {
                trackedDomainId: id,
                workflow: "reverify-ownership",
              });
              return { id, success: true };
            } catch (err) {
              logger.error(
                { trackedDomainId: id, err },
                "Failed to run reverify ownership workflow",
              );
              return { id, success: false };
            }
          }),
        );

        verifiedResults.push(...batchResults);
      }
    }

    const result = {
      scheduledPending: pendingDomainIds.length,
      pendingSuccessful: pendingResults.filter((r) => r.success).length,
      pendingFailed: pendingResults.filter((r) => !r.success).length,
      scheduledVerified: verifiedDomainIds.length,
      verifiedSuccessful: verifiedResults.filter((r) => r.success).length,
      verifiedFailed: verifiedResults.filter((r) => !r.success).length,
    };

    logger.info(result, "Reverify domains completed");

    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, "Reverify domains failed");
    return NextResponse.json(
      { error: "Failed to reverify domains" },
      { status: 500 },
    );
  }
}
