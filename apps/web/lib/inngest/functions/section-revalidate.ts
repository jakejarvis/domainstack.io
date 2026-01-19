import "server-only";

import { start } from "workflow/api";
import { analytics } from "@/lib/analytics/server";
import type { Section } from "@/lib/constants/sections";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { createLogger } from "@/lib/logger/server";
import { withConcurrencyHandling } from "@/lib/workflow/concurrency";
import { sectionRevalidateWorkflow } from "@/workflows/section-revalidate";

const logger = createLogger({ source: "inngest/section-revalidate" });

/**
 * Background revalidation function for a single domain+section.
 *
 * Note: Intentionally skips cache checking - this function is called for
 * scheduled revalidation when cached data has expired or is about to expire.
 */
export const sectionRevalidate = inngest.createFunction(
  {
    id: "section-revalidate",
    // Configure retry policy - Inngest will handle backoff automatically
    retries: 3,
    // Rate limit to avoid overwhelming external services
    rateLimit: {
      limit: 10,
      period: "1m",
    },
    // Concurrency control: prevent concurrent execution of the same domain+section
    concurrency: {
      limit: 1,
      key: "event.data.domain + ':' + event.data.section",
    },
    // Track failures after retries are exhausted
    onFailure: async ({ error, event }) => {
      const eventData = event.data.event.data as {
        domain: string;
        section: Section;
      };
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        {
          workflow: "section-revalidate",
          domain: eventData.domain,
          section: eventData.section,
          inngestRunId: event.data.run_id,
        },
        `workflow failed: ${errorMessage}`,
      );
      analytics.track(
        "workflow_failed",
        {
          workflow: "section-revalidate",
          domain: eventData.domain,
          section: eventData.section,
          classification: "retries_exhausted",
          error: errorMessage,
          inngestRunId: event.data.run_id,
        },
        "system",
      );
    },
  },
  { event: INNGEST_EVENTS.SECTION_REVALIDATE },
  async ({ event, step }) => {
    const { domain, section } = event.data as {
      domain: string;
      section: Section;
    };

    const result = await step.run("run-workflow", async () => {
      const run = await start(sectionRevalidateWorkflow, [{ domain, section }]);
      // Handle concurrency conflicts gracefully (returns undefined if another worker handled it)
      return await withConcurrencyHandling(run.returnValue, {
        domain,
        section,
        workflow: "section-revalidate",
      });
    });

    return result;
  },
);
