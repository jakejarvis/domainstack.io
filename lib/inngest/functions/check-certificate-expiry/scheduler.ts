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
    retries: 3,
    concurrency: {
      limit: 1, // Only one scheduler instance at a time
    },
  },
  { cron: "15 9 * * *" },
  async ({ step }) => {
    const trackedDomainIds = await step.run("fetch-ids", async () => {
      return await getVerifiedTrackedDomainIdsWithCertificates();
    });

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

    return { scheduled: events.length };
  },
);
