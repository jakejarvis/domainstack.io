import "server-only";

import { start } from "workflow/api";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { sectionRevalidateWorkflow } from "@/workflows/section-revalidate";

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
  },
  { event: INNGEST_EVENTS.SECTION_REVALIDATE },
  async ({ event, step }) => {
    const { domain, section } = event.data;

    const result = await step.run("run-workflow", async () => {
      const run = await start(sectionRevalidateWorkflow, [{ domain, section }]);
      return await run.returnValue;
    });

    return result;
  },
);
