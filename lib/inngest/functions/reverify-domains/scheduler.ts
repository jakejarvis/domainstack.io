import "server-only";
import { start } from "workflow/api";
import {
  getPendingTrackedDomainIds,
  getVerifiedTrackedDomainIds,
} from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { reverifyOwnershipWorkflow } from "@/workflows/reverify-ownership";
import { verifyPendingWorkflow } from "@/workflows/verify-pending";

/**
 * Cron job to schedule domain verification and re-verification.
 * Runs daily at 4:00 AM and 4:00 PM UTC.
 */
export const reverifyDomainsScheduler = inngest.createFunction(
  {
    id: "reverify-domains-scheduler",
    retries: 3,
    concurrency: {
      limit: 1, // Only one scheduler instance at a time
    },
  },
  { cron: "0 4,16 * * *" },
  async ({ step, logger: inngestLogger }) => {
    // 1. Process Pending Domains
    const pendingDomainIds = await step.run("fetch-pending-ids", async () => {
      return await getPendingTrackedDomainIds();
    });

    const pendingResults: { id: string; success: boolean }[] = [];
    if (pendingDomainIds.length > 0) {
      const BATCH_SIZE = 25;

      for (let i = 0; i < pendingDomainIds.length; i += BATCH_SIZE) {
        const batch = pendingDomainIds.slice(i, i + BATCH_SIZE);

        const batchResults = await step.run(
          `process-pending-batch-${i}`,
          async () => {
            const workflowPromises = batch.map(async (id) => {
              try {
                const run = await start(verifyPendingWorkflow, [
                  { trackedDomainId: id },
                ]);
                await run.returnValue;
                return { id, success: true };
              } catch (err) {
                inngestLogger.error("Failed to run verify pending workflow", {
                  trackedDomainId: id,
                  error: err instanceof Error ? err.message : String(err),
                });
                return { id, success: false };
              }
            });

            return await Promise.all(workflowPromises);
          },
        );

        pendingResults.push(...batchResults);
      }
    }

    // 2. Process Verified Domains (Re-verification)
    const verifiedDomainIds = await step.run("fetch-verified-ids", async () => {
      return await getVerifiedTrackedDomainIds();
    });

    const verifiedResults: { id: string; success: boolean }[] = [];
    if (verifiedDomainIds.length > 0) {
      const BATCH_SIZE = 25;

      for (let i = 0; i < verifiedDomainIds.length; i += BATCH_SIZE) {
        const batch = verifiedDomainIds.slice(i, i + BATCH_SIZE);

        const batchResults = await step.run(
          `process-verified-batch-${i}`,
          async () => {
            const workflowPromises = batch.map(async (id) => {
              try {
                const run = await start(reverifyOwnershipWorkflow, [
                  { trackedDomainId: id },
                ]);
                await run.returnValue;
                return { id, success: true };
              } catch (err) {
                inngestLogger.error(
                  "Failed to run reverify ownership workflow",
                  {
                    trackedDomainId: id,
                    error: err instanceof Error ? err.message : String(err),
                  },
                );
                return { id, success: false };
              }
            });

            return await Promise.all(workflowPromises);
          },
        );

        verifiedResults.push(...batchResults);
      }
    }

    return {
      scheduledPending: pendingDomainIds.length,
      pendingSuccessful: pendingResults.filter((r) => r.success).length,
      pendingFailed: pendingResults.filter((r) => !r.success).length,
      scheduledVerified: verifiedDomainIds.length,
      verifiedSuccessful: verifiedResults.filter((r) => r.success).length,
      verifiedFailed: verifiedResults.filter((r) => !r.success).length,
    };
  },
);
