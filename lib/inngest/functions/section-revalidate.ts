import "server-only";

import { start } from "workflow/api";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import type { Section } from "@/lib/schemas";
import { getDnsRecords } from "@/server/services/dns";
import { getHeaders } from "@/server/services/headers";
import { getHosting } from "@/server/services/hosting";
import { getSeo } from "@/server/services/seo";
import { certificatesWorkflow } from "@/workflows/certificates";
import { registrationWorkflow } from "@/workflows/registration";

async function runSingleSection(
  domain: string,
  section: Section,
): Promise<void> {
  switch (section) {
    case "dns":
      await getDnsRecords(domain);
      return;
    case "headers":
      await getHeaders(domain);
      return;
    case "hosting":
      await getHosting(domain);
      return;
    case "certificates": {
      const run = await start(certificatesWorkflow, [{ domain }]);
      await run.returnValue;
      return;
    }
    case "seo":
      await getSeo(domain);
      return;
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
