import "server-only";

import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { type Section, SectionEnum } from "@/lib/schemas";
import { getCertificates } from "@/server/services/certificates";
import { getDnsRecords } from "@/server/services/dns";
import { getHeaders } from "@/server/services/headers";
import { getHosting } from "@/server/services/hosting";
import { getRegistration } from "@/server/services/registration";
import { getSeo } from "@/server/services/seo";

const eventSchema = z.object({
  domain: z.string().min(1),
  section: SectionEnum,
});

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
    case "certificates":
      await getCertificates(domain);
      return;
    case "seo":
      await getSeo(domain);
      return;
    case "registration":
      await getRegistration(domain);
      return;
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
  async ({ event, step, logger: inngestLogger }) => {
    const { domain, section } = eventSchema.parse(event.data);

    inngestLogger.info("Starting section revalidation", {
      domainName: domain,
      section,
    });

    await step.run("revalidate", async () => {
      return await runSingleSection(domain, section);
    });

    inngestLogger.info("Section revalidation complete", {
      domainName: domain,
      section,
    });
  },
);
