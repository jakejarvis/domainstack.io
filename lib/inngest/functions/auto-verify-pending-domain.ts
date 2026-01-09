import "server-only";

import { start } from "workflow/api";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { autoVerifyWorkflow } from "@/workflows/auto-verify";

/**
 * Event-driven function to auto-verify a pending domain.
 * Triggered when a user adds a domain to track.
 *
 * This function simply triggers the durable workflow which handles
 * the retry schedule and verification logic.
 */
export const autoVerifyPendingDomain = inngest.createFunction(
  {
    id: "auto-verify-pending-domain",
    retries: 0, // Workflow handles its own retry logic
    // Prevent multiple verification attempts for the same domain
    concurrency: {
      limit: 1,
      key: "event.data.trackedDomainId",
    },
  },
  { event: INNGEST_EVENTS.AUTO_VERIFY_PENDING_DOMAIN },
  async ({ event, step }) => {
    const { trackedDomainId, domainName } = event.data;

    const result = await step.run("run-workflow", async () => {
      const run = await start(autoVerifyWorkflow, [
        { trackedDomainId, domainName },
      ]);
      return await run.returnValue;
    });

    return result;
  },
);
