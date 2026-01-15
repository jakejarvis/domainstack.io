import "server-only";

import { start } from "workflow/api";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { withConcurrencyHandling } from "@/lib/workflow/concurrency";
import { trackWorkflowFailureAsync } from "@/lib/workflow/observability";
import { autoVerifyWorkflow } from "@/workflows/auto-verify";
import { createBaselineWorkflow } from "@/workflows/initialize-snapshot";

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
      // Handle concurrency conflicts gracefully (returns undefined if another worker handled it)
      return await withConcurrencyHandling(run.returnValue, {
        trackedDomainId,
        domainName,
        workflow: "auto-verify",
      });
    });

    // If verification succeeded, create baseline snapshot for change detection
    if (result?.result === "verified") {
      await step.run("start-snapshot-workflow", async () => {
        void start(createBaselineWorkflow, [
          {
            trackedDomainId: result.trackedDomainId,
            domainId: result.domainId,
          },
        ]).catch((err) => {
          // Track failure for observability
          trackWorkflowFailureAsync({
            workflow: "initialize-snapshot-trigger",
            error: err instanceof Error ? err : new Error(String(err)),
            classification: "fatal",
            context: {
              trackedDomainId: result.trackedDomainId,
              domainId: result.domainId,
              trigger: "auto_verification_complete",
            },
          });
        });
      });
    }

    return result;
  },
);
