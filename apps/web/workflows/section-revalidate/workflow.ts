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
import { scheduleRevalidationBatchStep } from "@/workflows/shared/schedule-batch";
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
 * Note: Intentionally skips cache checking - this function is called for
 * scheduled revalidation when cached data has expired or is about to expire.
 *
 * Each section type calls the appropriate shared step directly at the workflow level,
 * ensuring proper durability and retry semantics. After persisting, schedules the
 * next revalidation based on access-based decay.
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
      const { lastAccessedAt } = await persistDnsRecordsStep(
        domain,
        fetchResult.data,
      );
      await scheduleRevalidationBatchStep(domain, ["dns"], lastAccessedAt);
      return { success: true, domain, section };
    }

    case "headers": {
      const fetchResult = await fetchHeadersStep(domain);
      if (!fetchResult.success) {
        return { success: false, domain, section, error: fetchResult.error };
      }
      const { lastAccessedAt } = await persistHeadersStep(
        domain,
        fetchResult.data,
      );
      await scheduleRevalidationBatchStep(domain, ["headers"], lastAccessedAt);
      return { success: true, domain, section };
    }

    case "hosting": {
      // Hosting requires DNS + headers data, fetch them first in parallel
      // DNS always succeeds or throws; headers may fail with typed error
      const [dnsResult, headersResult] = await Promise.all([
        fetchDnsRecordsStep(domain),
        fetchHeadersStep(domain),
      ]);

      // Track sections we update
      const updatedSections: Section[] = ["dns"];

      // Always persist DNS data if we got it
      let { lastAccessedAt } = await persistDnsRecordsStep(
        domain,
        dnsResult.data,
      );

      // If headers failed, schedule DNS revalidation and return partial success
      if (!headersResult.success) {
        await scheduleRevalidationBatchStep(
          domain,
          updatedSections,
          lastAccessedAt,
        );
        return {
          success: false,
          domain,
          section,
          error: headersResult.error,
        };
      }

      // Persist headers now that we know they succeeded
      const headersPersistedResult = await persistHeadersStep(
        domain,
        headersResult.data,
      );
      updatedSections.push("headers");
      lastAccessedAt = headersPersistedResult.lastAccessedAt ?? lastAccessedAt;

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
      const hostingPersistedResult = await persistHostingStep(
        domain,
        providers,
        geoResult?.geo ?? null,
      );
      updatedSections.push("hosting");
      lastAccessedAt = hostingPersistedResult.lastAccessedAt ?? lastAccessedAt;

      // Schedule revalidation for all updated sections
      await scheduleRevalidationBatchStep(
        domain,
        updatedSections,
        lastAccessedAt,
      );

      return { success: true, domain, section };
    }

    case "certificates": {
      const fetchResult = await fetchCertificateChainStep(domain);
      if (!fetchResult.success) {
        return { success: false, domain, section, error: fetchResult.error };
      }
      const processed = await processChainStep(fetchResult.data.chainJson);
      const { lastAccessedAt } = await persistCertificatesStep(
        domain,
        processed,
      );
      await scheduleRevalidationBatchStep(
        domain,
        ["certificates"],
        lastAccessedAt,
      );
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
      const { lastAccessedAt } = await persistSeoStep(
        domain,
        response,
        uploadedImageUrl,
      );
      await scheduleRevalidationBatchStep(domain, ["seo"], lastAccessedAt);
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
        const { lastAccessedAt } = await persistRegistrationStep(
          domain,
          normalized,
        );
        await scheduleRevalidationBatchStep(
          domain,
          ["registration"],
          lastAccessedAt,
        );
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
