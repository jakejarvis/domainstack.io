import { TRPCError } from "@trpc/server";
import { start } from "workflow/api";
import z from "zod";
import { toRegistrableDomain } from "@/lib/domain-server";
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
} from "@/trpc/init";

const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => {
    const registrable = toRegistrableDomain(domain);
    if (!registrable) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: '"domain" must be a valid and registrable',
      });
    }
    return { domain: registrable };
  });

export const domainRouter = createTRPCRouter({
  /**
   * Get registration data for a domain using a durable workflow.
   * Performs WHOIS/RDAP lookup with automatic retries.
   */
  getRegistration: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getRegistrationCached } = await import(
        "@/lib/db/repos/registrations"
      );

      // Check cache first
      const cached = await getRegistrationCached(input.domain);
      if (cached) {
        return {
          success: true,
          cached: true,
          data: cached,
        };
      }

      // Cache miss - run workflow
      const { registrationWorkflow } = await import("@/workflows/registration");
      const run = await start(registrationWorkflow, [{ domain: input.domain }]);
      const result = await run.returnValue;

      return {
        ...result,
        cached: false,
      };
    }),

  /**
   * Get DNS records for a domain using a durable workflow.
   * Queries multiple DoH providers with automatic fallback.
   */
  getDnsRecords: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getDnsCached } = await import("@/lib/db/repos/dns");

      // Check cache first
      const cached = await getDnsCached(input.domain);
      if (cached) {
        return {
          success: true,
          cached: true,
          data: cached,
        };
      }

      // Cache miss - run workflow
      const { dnsWorkflow } = await import("@/workflows/dns");
      const run = await start(dnsWorkflow, [{ domain: input.domain }]);
      const result = await run.returnValue;

      return {
        ...result,
        cached: false,
      };
    }),

  /**
   * Get hosting, DNS, and email provider data for a domain.
   * Detects providers from DNS records and HTTP headers.
   *
   * This procedure orchestrates DNS → headers → hosting to avoid
   * duplicate workflow executions when these are fetched in parallel.
   */
  getHosting: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getHostingCached } = await import("@/lib/db/repos/hosting");

      // Check cache first
      const cached = await getHostingCached(input.domain);
      if (cached) {
        return {
          success: true,
          cached: true,
          data: cached,
        };
      }

      // Cache miss - orchestrate DNS and headers first, then hosting
      const { dnsWorkflow } = await import("@/workflows/dns");
      const { headersWorkflow } = await import("@/workflows/headers");
      const { hostingWorkflow } = await import("@/workflows/hosting");

      // Phase 1: Fetch DNS and headers in parallel
      const [dnsRun, headersRun] = await Promise.all([
        start(dnsWorkflow, [{ domain: input.domain }]),
        start(headersWorkflow, [{ domain: input.domain }]),
      ]);

      const [dnsResult, headersResult] = await Promise.all([
        dnsRun.returnValue,
        headersRun.returnValue,
      ]);

      // Phase 2: Hosting uses the already-fetched data
      // If both upstream workflows failed, we have no data to detect providers from
      if (!dnsResult.success && !headersResult.success) {
        return {
          success: false,
          cached: false,
          error: "Failed to fetch DNS records and HTTP headers",
          data: null,
        };
      }

      // Guard against null data from failed workflows (partial data is okay)
      const dnsRecords = dnsResult.data?.records ?? [];
      const headers = headersResult.data?.headers ?? [];

      const hostingRun = await start(hostingWorkflow, [
        {
          domain: input.domain,
          dnsRecords,
          headers,
        },
      ]);
      const result = await hostingRun.returnValue;

      return {
        ...result,
        cached: false,
      };
    }),

  /**
   * Get SSL certificates for a domain using a durable workflow.
   * Performs TLS handshake with automatic retries.
   */
  getCertificates: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCertificatesCached } = await import(
        "@/lib/db/repos/certificates"
      );

      // Check cache first
      const cached = await getCertificatesCached(input.domain);
      if (cached) {
        return {
          success: true,
          cached: true,
          data: cached,
        };
      }

      // Cache miss - run workflow
      const { certificatesWorkflow } = await import("@/workflows/certificates");
      const run = await start(certificatesWorkflow, [{ domain: input.domain }]);
      const result = await run.returnValue;

      return {
        ...result,
        cached: false,
      };
    }),

  /**
   * Get HTTP headers for a domain using a durable workflow.
   * Probes the domain with automatic retries.
   */
  getHeaders: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getHeadersCached } = await import("@/lib/db/repos/headers");

      // Check cache first
      const cached = await getHeadersCached(input.domain);
      if (cached) {
        return {
          success: true,
          cached: true,
          data: cached,
        };
      }

      // Cache miss - run workflow
      const { headersWorkflow } = await import("@/workflows/headers");
      const run = await start(headersWorkflow, [{ domain: input.domain }]);
      const result = await run.returnValue;

      return {
        ...result,
        cached: false,
      };
    }),

  /**
   * Get SEO data for a domain using a durable workflow.
   * Fetches HTML, robots.txt, and OG images with automatic retries.
   */
  getSeo: domainProcedure.input(DomainInputSchema).query(async ({ input }) => {
    const { getSeoCached } = await import("@/lib/db/repos/seo");

    // Check cache first
    const cached = await getSeoCached(input.domain);
    if (cached) {
      return {
        success: true,
        cached: true,
        data: cached,
      };
    }

    // Cache miss - run workflow
    const { seoWorkflow } = await import("@/workflows/seo");
    const run = await start(seoWorkflow, [{ domain: input.domain }]);
    const result = await run.returnValue;

    return {
      ...result,
      cached: false,
    };
  }),

  /**
   * Get a favicon for a domain using a durable workflow.
   * Fetches from multiple sources with automatic retries.
   */
  getFavicon: publicProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getFaviconByDomain } = await import("@/lib/db/repos/favicons");

      // Check cache first
      const cachedRecord = await getFaviconByDomain(input.domain);

      if (cachedRecord) {
        // Only treat as cache hit if we have a definitive result:
        // - url is present (string), OR
        // - url is null but marked as permanently not found
        const isDefinitiveResult =
          cachedRecord.url !== null || cachedRecord.notFound === true;

        if (isDefinitiveResult) {
          return {
            success: true,
            cached: true,
            data: {
              url: cachedRecord.url,
            },
          };
        }
      }

      // Cache miss - run workflow
      const { faviconWorkflow } = await import("@/workflows/favicon");
      const run = await start(faviconWorkflow, [{ domain: input.domain }]);
      const result = await run.returnValue;

      return {
        ...result,
        cached: false,
      };
    }),
});
