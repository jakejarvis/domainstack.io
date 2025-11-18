import "server-only";

import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { type Section, SectionEnum } from "@/lib/schemas";
import { getCertificates } from "@/server/services/certificates";
import { resolveAll } from "@/server/services/dns";
import { probeHeaders } from "@/server/services/headers";
import { detectHosting } from "@/server/services/hosting";
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
      await resolveAll(domain);
      return;
    case "headers":
      await probeHeaders(domain);
      return;
    case "hosting":
      await detectHosting(domain);
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
  { event: "section/revalidate" },
  async ({ event, step, logger }) => {
    const { domain, section } = eventSchema.parse(event.data);

    // Normalize domain
    const normalizedDomain = domain.trim().toLowerCase();

    await step.run("revalidate", async () => {
      logger.info("start", {
        domain: normalizedDomain,
        section,
      });

      await runSingleSection(normalizedDomain, section);

      logger.info("done", {
        domain: normalizedDomain,
        section,
      });
    });
  },
);
