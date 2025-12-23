import "server-only";
import { getVerifiedTrackedDomainIdsWithCertificates } from "@/lib/db/repos/certificates";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";

/**
 * Cron job to schedule certificate expiry checks.
 * Runs daily at 9:15 AM UTC.
 */
export const checkCertificateExpiryScheduler = inngest.createFunction(
  {
    id: "check-certificate-expiry-scheduler",
  },
  { cron: "15 9 * * *" },
  async ({ step, logger }) => {
    logger.info("Starting certificate expiry check scheduler");

    const trackedDomainIds = await step.run("fetch-ids", async () => {
      return await getVerifiedTrackedDomainIdsWithCertificates();
    });

    logger.info(
      `Found ${trackedDomainIds.length} domains with certificates to check`,
    );

    if (trackedDomainIds.length === 0) {
      return { scheduled: 0 };
    }

    const events = trackedDomainIds.map((id) => ({
      name: INNGEST_EVENTS.CHECK_CERTIFICATE_EXPIRY,
      data: {
        trackedDomainId: id,
      },
    }));

    await step.sendEvent("dispatch-cert-expiry-events", events);

    logger.info(
      `Scheduled certificate expiry checks for ${events.length} domains`,
    );

    return { scheduled: events.length };
  },
);
