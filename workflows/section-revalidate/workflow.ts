import { start } from "workflow/api";
import type { Section } from "@/lib/types";
import { certificatesWorkflow } from "@/workflows/certificates";
import { dnsWorkflow } from "@/workflows/dns";
import { headersWorkflow } from "@/workflows/headers";
import { hostingWorkflow } from "@/workflows/hosting";
import { registrationWorkflow } from "@/workflows/registration";
import { seoWorkflow } from "@/workflows/seo";

export interface SectionRevalidateWorkflowInput {
  domain: string;
  section: Section;
}

export interface SectionRevalidateWorkflowResult {
  success: boolean;
  domain: string;
  section: Section;
}

/**
 * Durable workflow to revalidate a single section for a domain.
 *
 * Note: Intentionally skips cache checking - this function is called for
 * scheduled revalidation when cached data has expired or is about to expire.
 */
export async function sectionRevalidateWorkflow(
  input: SectionRevalidateWorkflowInput,
): Promise<SectionRevalidateWorkflowResult> {
  "use workflow";

  const { domain, section } = input;

  await runSection(domain, section);

  return { success: true, domain, section };
}

async function runSection(domain: string, section: Section): Promise<void> {
  "use step";

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
