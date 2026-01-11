import "server-only";

import { start } from "workflow/api";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { withConcurrencyHandling } from "@/lib/workflow/concurrency";
import { initializeSnapshotWorkflow } from "@/workflows/initialize-snapshot";

/**
 * Event-driven function to initialize a snapshot for a newly verified tracked domain.
 * This establishes the baseline state for change detection.
 */
export const initializeSnapshot = inngest.createFunction(
  {
    id: "initialize-snapshot",
    retries: 3,
  },
  { event: INNGEST_EVENTS.SNAPSHOT_INITIALIZE },
  async ({ event, step }) => {
    const { trackedDomainId, domainId } = event.data;

    const result = await step.run("run-workflow", async () => {
      const run = await start(initializeSnapshotWorkflow, [
        { trackedDomainId, domainId },
      ]);
      // Handle concurrency conflicts gracefully (returns undefined if another worker handled it)
      return await withConcurrencyHandling(run.returnValue, {
        trackedDomainId,
        domainId,
        workflow: "initialize-snapshot",
      });
    });

    return result;
  },
);
