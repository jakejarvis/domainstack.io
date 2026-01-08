import "server-only";
import { start } from "workflow/api";
import { getMonitoredSnapshotIds } from "@/lib/db/repos/snapshots";
import { inngest } from "@/lib/inngest/client";
import { monitorDomainWorkflow } from "@/workflows/monitor-domain";

/**
 * Cron job to schedule monitoring for tracked domains.
 * Runs every 4 hours.
 * Fetches all monitored domain IDs and starts workflows for parallel processing.
 */
export const monitorTrackedDomainsScheduler = inngest.createFunction(
  {
    id: "monitor-tracked-domains-scheduler",
    retries: 3,
    concurrency: {
      limit: 1, // Only one scheduler instance at a time
    },
  },
  { cron: "0 */4 * * *" }, // Every 4 hours
  async ({ step, logger: inngestLogger }) => {
    // Fetch all tracked domain IDs for verified, non-archived domains
    const trackedDomainIds = await step.run(
      "fetch-tracked-domain-ids",
      async () => {
        return await getMonitoredSnapshotIds();
      },
    );

    if (trackedDomainIds.length === 0) {
      return { scheduled: 0 };
    }

    // Start all workflows in parallel (in batches to avoid overwhelming the system)
    const BATCH_SIZE = 25; // Smaller batch for monitoring due to heavier workload
    const results: { id: string; success: boolean }[] = [];

    for (let i = 0; i < trackedDomainIds.length; i += BATCH_SIZE) {
      const batch = trackedDomainIds.slice(i, i + BATCH_SIZE);

      const batchResults = await step.run(`process-batch-${i}`, async () => {
        const workflowPromises = batch.map(async (id) => {
          try {
            const run = await start(monitorDomainWorkflow, [
              { trackedDomainId: id },
            ]);
            await run.returnValue;
            return { id, success: true };
          } catch (err) {
            inngestLogger.error("Failed to run monitor domain workflow", {
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

    return { scheduled: trackedDomainIds.length, successful, failed };
  },
);
