import "server-only";
import {
  getPendingTrackedDomainIds,
  getVerifiedTrackedDomainIds,
} from "@/lib/db/repos/tracked-domains";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";

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
  async ({ step, logger }) => {
    logger.info("Starting domain verification scheduler");

    // 1. Process Pending Domains
    const pendingDomainIds = await step.run("fetch-pending-ids", async () => {
      return await getPendingTrackedDomainIds();
    });

    logger.info(`Found ${pendingDomainIds.length} pending domains to verify`);

    if (pendingDomainIds.length > 0) {
      const pendingEvents = pendingDomainIds.map((id) => ({
        name: INNGEST_EVENTS.VERIFY_PENDING_CRON,
        data: {
          trackedDomainId: id,
        },
      }));

      await step.sendEvent("dispatch-pending-events", pendingEvents);
      logger.info(
        `Scheduled verification for ${pendingEvents.length} pending domains`,
      );
    }

    // 2. Process Verified Domains (Re-verification)
    const verifiedDomainIds = await step.run("fetch-verified-ids", async () => {
      return await getVerifiedTrackedDomainIds();
    });

    logger.info(
      `Found ${verifiedDomainIds.length} verified domains to re-verify`,
    );

    if (verifiedDomainIds.length > 0) {
      const verifiedEvents = verifiedDomainIds.map((id) => ({
        name: INNGEST_EVENTS.REVERIFY_OWNERSHIP,
        data: {
          trackedDomainId: id,
        },
      }));

      await step.sendEvent("dispatch-verified-events", verifiedEvents);
      logger.info(
        `Scheduled re-verification for ${verifiedEvents.length} verified domains`,
      );
    }

    return {
      scheduledPending: pendingDomainIds.length,
      scheduledVerified: verifiedDomainIds.length,
    };
  },
);
