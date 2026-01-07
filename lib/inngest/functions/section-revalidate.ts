import "server-only";

import { start } from "workflow/api";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import type { Section } from "@/lib/types";
import { certificatesWorkflow } from "@/workflows/certificates";
import { dnsWorkflow } from "@/workflows/dns";
import { headersWorkflow } from "@/workflows/headers";
import { hostingWorkflow } from "@/workflows/hosting";
import { registrationWorkflow } from "@/workflows/registration";
import { seoWorkflow } from "@/workflows/seo";

/**
 * Run a single section revalidation for a domain.
 *
 * Note: Intentionally skips cache checking - this function is called for
 * scheduled revalidation when cached data has expired or is about to expire.
 * The TTL-based scheduling in scheduleRevalidation() ensures we only call
 * this when data actually needs refreshing.
 */
async function runSingleSection(
  domain: string,
  section: Section,
): Promise<void> {
  switch (section) {
    case "dns": {
      const run = await start(dnsWorkflow, [{ domain }]);
      await run.returnValue;
      return;
    }
    case "headers": {
      const run = await start(headersWorkflow, [{ domain }]);
      await run.returnValue;
      return;
    }
    case "hosting": {
      // Hosting requires DNS + headers data, fetch them first
      const [dnsRun, headersRun] = await Promise.all([
        start(dnsWorkflow, [{ domain }]),
        start(headersWorkflow, [{ domain }]),
      ]);
      const [dnsResult, headersResult] = await Promise.all([
        dnsRun.returnValue,
        headersRun.returnValue,
      ]);
      const hostingRun = await start(hostingWorkflow, [
        {
          domain,
          dnsRecords: dnsResult.data.records,
          headers: headersResult.data.headers,
        },
      ]);
      await hostingRun.returnValue;
      return;
    }
    case "certificates": {
      const run = await start(certificatesWorkflow, [{ domain }]);
      await run.returnValue;
      return;
    }
    case "seo": {
      const run = await start(seoWorkflow, [{ domain }]);
      await run.returnValue;
      return;
    }
    case "registration": {
      const run = await start(registrationWorkflow, [{ domain }]);
      await run.returnValue;
      return;
    }
  }
}

/**
 * Background revalidation function for a single domain+section.
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
    // This is our ONLY concurrency mechanism - no Redis locks needed
    concurrency: {
      limit: 1,
      key: "event.data.domain + ':' + event.data.section",
    },
  },
  { event: INNGEST_EVENTS.SECTION_REVALIDATE },
  async ({ event, step }) => {
    const { domain, section } = event.data;

    await step.run("revalidate", async () => {
      return await runSingleSection(domain, section);
    });
  },
);
