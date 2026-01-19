import type { Section } from "@/lib/constants/sections";
import {
  fetchCertificateChainStep,
  persistCertificatesStep,
  processChainStep,
} from "@/workflows/shared/certificates";
import { checkBlocklist } from "@/workflows/shared/check-blocklist";
import {
  fetchDnsRecordsStep,
  persistDnsRecordsStep,
} from "@/workflows/shared/dns";
import {
  fetchHeadersStep,
  persistHeadersStep,
} from "@/workflows/shared/headers";
import {
  detectAndResolveProvidersStep,
  lookupGeoIpStep,
  persistHostingStep,
} from "@/workflows/shared/hosting";
import {
  lookupWhoisStep,
  normalizeAndBuildResponseStep,
  persistRegistrationStep,
} from "@/workflows/shared/registration";
import {
  buildSeoResponseStep,
  fetchHtmlStep,
  fetchRobotsStep,
  persistSeoStep,
  processOgImageStep,
} from "@/workflows/shared/seo";

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
 * This workflow is triggered by:
 * - SWR (stale-while-revalidate) pattern when stale data is accessed
 * - Warm-cache cron job for recently-accessed domains
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
      // DNS always succeeds or throws RetryableError
      const fetchResult = await fetchDnsRecordsStep(domain);
      await persistDnsRecordsStep(domain, fetchResult.data);
      return { success: true, domain, section };
    }

    case "headers": {
      const fetchResult = await fetchHeadersStep(domain);
      if (!fetchResult.success) {
        return { success: false, domain, section, error: fetchResult.error };
      }
      await persistHeadersStep(domain, fetchResult.data);
      return { success: true, domain, section };
    }

    case "hosting": {
      // Hosting requires DNS + headers data, fetch them first in parallel
      // DNS always succeeds or throws; headers may fail with typed error
      const [dnsResult, headersResult] = await Promise.all([
        fetchDnsRecordsStep(domain),
        fetchHeadersStep(domain),
      ]);

      // Always persist DNS data if we got it
      await persistDnsRecordsStep(domain, dnsResult.data);

      // If headers failed, return partial success
      if (!headersResult.success) {
        return {
          success: false,
          domain,
          section,
          error: headersResult.error,
        };
      }

      // Persist headers now that we know they succeeded
      await persistHeadersStep(domain, headersResult.data);

      // GeoIP lookup
      const a = dnsResult.data.records.find((d) => d.type === "A");
      const aaaa = dnsResult.data.records.find((d) => d.type === "AAAA");
      const ip = (a?.value || aaaa?.value) ?? null;
      const geoResult = ip ? await lookupGeoIpStep(ip) : null;

      // Detect providers
      const providers = await detectAndResolveProvidersStep(
        dnsResult.data.records,
        headersResult.data.headers,
        geoResult,
      );

      // Persist hosting
      await persistHostingStep(domain, providers, geoResult?.geo ?? null);

      return { success: true, domain, section };
    }

    case "certificates": {
      const fetchResult = await fetchCertificateChainStep(domain);
      if (!fetchResult.success) {
        return { success: false, domain, section, error: fetchResult.error };
      }
      const processed = await processChainStep(fetchResult.data.chainJson);
      await persistCertificatesStep(domain, processed);
      return { success: true, domain, section };
    }

    case "seo": {
      const htmlResult = await fetchHtmlStep(domain);
      const robotsResult = await fetchRobotsStep(domain);

      // Process OG image if present and not blocked
      let uploadedImageUrl: string | null = null;
      if (htmlResult.preview?.image) {
        const isBlocked = await checkBlocklist(domain);
        if (!isBlocked) {
          const imageResult = await processOgImageStep(
            domain,
            htmlResult.preview.image,
            htmlResult.finalUrl,
          );
          uploadedImageUrl = imageResult.url;
        }
      }

      // Build and persist response
      const response = await buildSeoResponseStep(
        htmlResult,
        robotsResult,
        uploadedImageUrl,
      );
      await persistSeoStep(domain, response, uploadedImageUrl);
      return { success: true, domain, section };
    }

    case "registration": {
      const rdapResult = await lookupWhoisStep(domain);
      if (!rdapResult.success) {
        return { success: false, domain, section, error: rdapResult.error };
      }
      const normalized = await normalizeAndBuildResponseStep(
        rdapResult.data.recordJson,
      );
      if (normalized.isRegistered) {
        await persistRegistrationStep(domain, normalized);
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
