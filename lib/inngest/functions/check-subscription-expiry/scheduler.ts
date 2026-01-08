import "server-only";
import { start } from "workflow/api";
import { getUserIdsWithEndingSubscriptions } from "@/lib/db/repos/user-subscription";
import { inngest } from "@/lib/inngest/client";
import { subscriptionExpiryWorkflow } from "@/workflows/subscription-expiry";

/**
 * Cron job to schedule subscription expiry checks.
 * Runs daily at 9:30 AM UTC (after domain/certificate expiry checks).
 */
export const checkSubscriptionExpiryScheduler = inngest.createFunction(
  {
    id: "check-subscription-expiry-scheduler",
    retries: 3,
    concurrency: {
      limit: 1, // Only one scheduler instance at a time
    },
  },
  { cron: "30 9 * * *" }, // Daily at 9:30 AM UTC
  async ({ step, logger: inngestLogger }) => {
    const userIds = await step.run("fetch-user-ids", async () => {
      return await getUserIdsWithEndingSubscriptions();
    });

    if (userIds.length === 0) {
      return { scheduled: 0 };
    }

    // Start all workflows in parallel (in batches to avoid overwhelming the system)
    const BATCH_SIZE = 50;
    const results: { id: string; success: boolean }[] = [];

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);

      const batchResults = await step.run(`process-batch-${i}`, async () => {
        const workflowPromises = batch.map(async (id) => {
          try {
            const run = await start(subscriptionExpiryWorkflow, [
              { userId: id },
            ]);
            await run.returnValue;
            return { id, success: true };
          } catch (err) {
            inngestLogger.error("Failed to run subscription expiry workflow", {
              userId: id,
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

    return { scheduled: userIds.length, successful, failed };
  },
);
