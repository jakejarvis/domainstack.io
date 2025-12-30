import "server-only";
import { getUserIdsWithEndingSubscriptions } from "@/lib/db/repos/user-subscription";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";

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
  async ({ step }) => {
    const userIds = await step.run("fetch-user-ids", async () => {
      return await getUserIdsWithEndingSubscriptions();
    });

    if (userIds.length === 0) {
      return { scheduled: 0 };
    }

    const events = userIds.map((id) => ({
      name: INNGEST_EVENTS.CHECK_SUBSCRIPTION_EXPIRY,
      data: {
        userId: id,
      },
    }));

    await step.sendEvent("dispatch-subscription-expiry-events", events);

    return { scheduled: events.length };
  },
);
