import type { Section } from "@/lib/types";
import { fetchCertificatesData } from "@/workflows/shared/fetch-certificates";
import { fetchDnsData } from "@/workflows/shared/fetch-dns";
import { fetchHeadersData } from "@/workflows/shared/fetch-headers";
import { fetchHostingData } from "@/workflows/shared/fetch-hosting";
import { fetchRegistrationData } from "@/workflows/shared/fetch-registration";
import { fetchSeoData } from "@/workflows/shared/fetch-seo";

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
 *
 * Each section type calls the appropriate shared step directly at the workflow level,
 * ensuring proper durability and retry semantics.
 */
export async function sectionRevalidateWorkflow(
  input: SectionRevalidateWorkflowInput,
): Promise<SectionRevalidateWorkflowResult> {
  "use workflow";

  const { domain, section } = input;

  switch (section) {
    case "dns": {
      const result = await fetchDnsData(domain);
      if (!result.success) {
        return { success: false, domain, section, error: result.error };
      }
      return { success: true, domain, section };
    }

    case "headers": {
      const result = await fetchHeadersData(domain);
      if (!result.success) {
        return { success: false, domain, section, error: result.error };
      }
      return { success: true, domain, section };
    }

    case "hosting": {
      // Hosting requires DNS + headers data, fetch them first in parallel
      const [dnsResult, headersResult] = await Promise.all([
        fetchDnsData(domain),
        fetchHeadersData(domain),
      ]);

      if (!dnsResult.success || !dnsResult.data) {
        return { success: false, domain, section, error: dnsResult.error };
      }
      if (!headersResult.success || !headersResult.data) {
        return { success: false, domain, section, error: headersResult.error };
      }
      const hostingResult = await fetchHostingData(
        domain,
        dnsResult.data.records,
        headersResult.data.headers,
      );

      if (!hostingResult.success) {
        return { success: false, domain, section, error: hostingResult.error };
      }
      return { success: true, domain, section };
    }

    case "certificates": {
      const result = await fetchCertificatesData(domain);
      if (!result.success) {
        return { success: false, domain, section, error: result.error };
      }
      return { success: true, domain, section };
    }

    case "seo": {
      const result = await fetchSeoData(domain);
      if (!result.success) {
        return { success: false, domain, section, error: result.error };
      }
      return { success: true, domain, section };
    }

    case "registration": {
      const result = await fetchRegistrationData(domain);
      if (!result.success) {
        return { success: false, domain, section, error: result.error };
      }
      return { success: true, domain, section };
    }

    default: {
      // Exhaustiveness check - TypeScript will error if a Section case is missing
      const _exhaustive: never = section;
      return {
        success: false,
        domain,
        section,
        error: `Unhandled section: ${_exhaustive}`,
      };
    }
  }
}
