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
  error?: string;
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

  const result = await runSection(domain, section);

  if (!result.success) {
    return { success: false, domain, section, error: result.error };
  }

  return { success: true, domain, section };
}

type RunSectionResult = { success: true } | { success: false; error: string };

async function runSection(
  domain: string,
  section: Section,
): Promise<RunSectionResult> {
  "use step";

  switch (section) {
    case "dns": {
      const run = await start(dnsWorkflow, [{ domain }]);
      const result = await run.returnValue;
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    }
    case "headers": {
      const run = await start(headersWorkflow, [{ domain }]);
      const result = await run.returnValue;
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
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

      // Check DNS workflow success
      if (!dnsResult.success) {
        return { success: false, error: dnsResult.error };
      }

      // Check headers workflow success
      if (!headersResult.success) {
        return { success: false, error: headersResult.error };
      }

      const hostingRun = await start(hostingWorkflow, [
        {
          domain,
          dnsRecords: dnsResult.data.records,
          headers: headersResult.data.headers,
        },
      ]);
      const hostingResult = await hostingRun.returnValue;
      if (!hostingResult.success) {
        return { success: false, error: hostingResult.error };
      }
      return { success: true };
    }
    case "certificates": {
      const run = await start(certificatesWorkflow, [{ domain }]);
      const result = await run.returnValue;
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    }
    case "seo": {
      const run = await start(seoWorkflow, [{ domain }]);
      const result = await run.returnValue;
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    }
    case "registration": {
      const run = await start(registrationWorkflow, [{ domain }]);
      const result = await run.returnValue;
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    }
    default: {
      // Exhaustiveness check - TypeScript will error if a Section case is missing
      const _exhaustive: never = section;
      return { success: false, error: `Unhandled section: ${_exhaustive}` };
    }
  }
}
