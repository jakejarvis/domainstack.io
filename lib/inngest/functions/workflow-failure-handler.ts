import "server-only";

import { analytics } from "@/lib/analytics/server";
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_EVENTS,
  type WorkflowFailedPayload,
} from "@/lib/inngest/events";
import { createLogger } from "@/lib/logger/server";

const logger = createLogger({ source: "inngest/workflow-failure-handler" });

/**
 * Handler for workflow failure events.
 *
 * This function:
 * 1. Aggregates failure events for observability
 * 2. Tracks exceptions in PostHog for analysis
 * 3. Could be extended to trigger alerts (Slack, email, etc.)
 *
 * The separation of concerns allows workflows to fail fast while
 * this handler deals with observability asynchronously.
 */
export const workflowFailureHandler = inngest.createFunction(
  {
    id: "workflow-failure-handler",
    // Don't retry - if we can't process the failure event, log and move on
    retries: 0,
    // Rate limit to avoid overwhelming alerting systems during cascading failures
    rateLimit: {
      limit: 100,
      period: "1m",
    },
  },
  { event: INNGEST_EVENTS.WORKFLOW_FAILED },
  async ({ event }) => {
    const payload = event.data as WorkflowFailedPayload;
    const {
      workflow,
      domain,
      section,
      error,
      classification,
      context,
      failedAt,
    } = payload;

    // Track in PostHog for analysis dashboards
    analytics.track(
      "workflow_failed",
      {
        workflow,
        domain,
        section,
        classification,
        error,
        context,
        failedAt,
      },
      "system", // Use "system" as distinct_id for system events
    );

    // Track as exception for PostHog error tracking
    analytics.trackException(
      new Error(`Workflow ${workflow} failed: ${error}`),
      {
        workflow,
        domain,
        section,
        classification,
        context,
        failedAt,
      },
      "system",
    );

    // Log summary for Vercel logs
    logger.info(
      {
        workflow,
        domain,
        section,
        classification,
        failedAt,
      },
      `processed workflow failure event: ${error}`,
    );

    // Future: Add alerting integrations here
    // - Slack webhook for critical failures
    // - Email digest for recurring failures
    // - PagerDuty for production incidents

    return {
      processed: true,
      workflow,
      domain,
      classification,
    };
  },
);
