import "server-only";
import { start } from "workflow/api";
import { getVerifiedTrackedDomainIds } from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { domainExpiryWorkflow } from "@/workflows/domain-expiry";

/**
 * Cron job to schedule domain expiry checks.
 * Runs daily at 9:00 AM UTC.
 */
export const checkDomainExpiryScheduler = inngest.createFunction(
  {
    id: "check-domain-expiry-scheduler",
    retries: 3,
    concurrency: {
      limit: 1, // Only one scheduler instance at a time
    },
  },
  { cron: "0 9 * * *" },
  async ({ step, logger: inngestLogger }) => {
    const verifiedDomainIds = await step.run("fetch-verified-ids", async () => {
      return await getVerifiedTrackedDomainIds();
    });

    if (verifiedDomainIds.length === 0) {
      return { scheduled: 0 };
    }

    // Start all workflows in parallel (in batches to avoid overwhelming the system)
    const BATCH_SIZE = 50;
    const results: { id: string; success: boolean }[] = [];

    for (let i = 0; i < verifiedDomainIds.length; i += BATCH_SIZE) {
      const batch = verifiedDomainIds.slice(i, i + BATCH_SIZE);

      const batchResults = await step.run(`process-batch-${i}`, async () => {
        const workflowPromises = batch.map(async (id) => {
          try {
            const run = await start(domainExpiryWorkflow, [
              { trackedDomainId: id },
            ]);
            await run.returnValue;
            return { id, success: true };
          } catch (err) {
            inngestLogger.error("Failed to run domain expiry workflow", {
              trackedDomainId: id,
              error: err instanceof Error ? err.message : String(err),
            });
            return { id, success: false };
          }
        });

        return await Promise.all(workflowPromises);
      });

      results.push(...batchResults);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return { scheduled: verifiedDomainIds.length, successful, failed };
  },
);
