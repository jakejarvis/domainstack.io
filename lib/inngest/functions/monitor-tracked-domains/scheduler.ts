import "server-only";
import { getMonitoredSnapshotIds } from "@/lib/db/repos/snapshots";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";

/**
 * Cron job to schedule monitoring for tracked domains.
 * Runs every 4 hours.
 * Fetches all monitored domain IDs and dispatches events for parallel processing.
 */
export const monitorTrackedDomainsScheduler = inngest.createFunction(
  {
    id: "monitor-tracked-domains-scheduler",
  },
  { cron: "0 */4 * * *" }, // Every 4 hours
  async ({ step, logger }) => {
    logger.info("Starting tracked domain monitoring scheduler");

    // Fetch all tracked domain IDs for verified, non-archived domains
    // This is a lightweight query that just returns UUIDs
    const trackedDomainIds = await step.run(
      "fetch-tracked-domain-ids",
      async () => {
        return await getMonitoredSnapshotIds();
      },
    );

    logger.info(`Found ${trackedDomainIds.length} tracked domains to monitor`);

    if (trackedDomainIds.length === 0) {
      return { scheduled: 0 };
    }

    // Dispatch events for each domain
    // Inngest handles batching these events efficiently
    const events = trackedDomainIds.map((id) => ({
      name: INNGEST_EVENTS.MONITOR_CHANGES,
      data: {
        trackedDomainId: id,
      },
    }));

    await step.sendEvent("dispatch-monitoring-events", events);

    logger.info(`Scheduled monitoring for ${events.length} domains`);

    return { scheduled: events.length };
  },
);
