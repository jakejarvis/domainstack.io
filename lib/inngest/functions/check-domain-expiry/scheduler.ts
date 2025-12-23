import "server-only";
import { getVerifiedTrackedDomainIds } from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";

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
  async ({ step, logger }) => {
    logger.info("Starting domain expiry check scheduler");

    const verifiedDomainIds = await step.run("fetch-verified-ids", async () => {
      return await getVerifiedTrackedDomainIds();
    });

    logger.info(`Found ${verifiedDomainIds.length} domains to check`);

    if (verifiedDomainIds.length === 0) {
      return { scheduled: 0 };
    }

    const events = verifiedDomainIds.map((id) => ({
      name: INNGEST_EVENTS.CHECK_DOMAIN_EXPIRY,
      data: {
        trackedDomainId: id,
      },
    }));

    await step.sendEvent("dispatch-expiry-events", events);

    logger.info(`Scheduled expiry checks for ${events.length} domains`);

    return { scheduled: events.length };
  },
);
