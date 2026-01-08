import "server-only";
import { start } from "workflow/api";
import { getVerifiedTrackedDomainIdsWithCertificates } from "@/lib/db/repos/certificates";
import { inngest } from "@/lib/inngest/client";
import { certificateExpiryWorkflow } from "@/workflows/certificate-expiry";

/**
 * Cron job to schedule certificate expiry checks.
 * Runs daily at 9:15 AM UTC.
 */
export const checkCertificateExpiryScheduler = inngest.createFunction(
  {
    id: "check-certificate-expiry-scheduler",
    retries: 3,
    concurrency: {
      limit: 1, // Only one scheduler instance at a time
    },
  },
  { cron: "15 9 * * *" },
  async ({ step, logger: inngestLogger }) => {
    const trackedDomainIds = await step.run("fetch-ids", async () => {
      return await getVerifiedTrackedDomainIdsWithCertificates();
    });

    if (trackedDomainIds.length === 0) {
      return { scheduled: 0 };
    }

    // Start all workflows in parallel (in batches to avoid overwhelming the system)
    const BATCH_SIZE = 50;
    const results: { id: string; success: boolean }[] = [];

    for (let i = 0; i < trackedDomainIds.length; i += BATCH_SIZE) {
      const batch = trackedDomainIds.slice(i, i + BATCH_SIZE);

      const batchResults = await step.run(`process-batch-${i}`, async () => {
        const workflowPromises = batch.map(async (id) => {
          try {
            const run = await start(certificateExpiryWorkflow, [
              { trackedDomainId: id },
            ]);
            await run.returnValue;
            return { id, success: true };
          } catch (err) {
            inngestLogger.error("Failed to run certificate expiry workflow", {
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
