import { TRPCError } from "@trpc/server";
import { start } from "workflow/api";
import z from "zod";
import { analytics } from "@/lib/analytics/server";
import { createLogger } from "@/lib/logger/server";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import { withSwrCache } from "@/lib/workflow/swr";
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
} from "@/trpc/init";

const logger = createLogger({ source: "routers/domain" });

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
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getRegistration: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getRegistration } = await import("@/lib/db/repos/registrations");
      const { registrationWorkflow } = await import("@/workflows/registration");

      return withSwrCache({
        workflowName: "registration",
        domain: input.domain,
        getCached: () => getRegistration(input.domain),
        startWorkflow: () =>
          start(registrationWorkflow, [{ domain: input.domain }]),
      });
    }),

  /**
   * Get DNS records for a domain using a durable workflow.
   * Queries multiple DoH providers with automatic fallback.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getDnsRecords: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getDns } = await import("@/lib/db/repos/dns");
      const { dnsWorkflow } = await import("@/workflows/dns");

      return withSwrCache({
        workflowName: "dns",
        domain: input.domain,
        getCached: () => getDns(input.domain),
        startWorkflow: () => start(dnsWorkflow, [{ domain: input.domain }]),
      });
    }),

  /**
   * Get hosting, DNS, and email provider data for a domain.
   * Detects providers from DNS records and HTTP headers.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   *
   * Note: This procedure has special orchestration logic because hosting
   * depends on DNS and headers data. The SWR pattern is applied at the
   * top-level (hosting cache) only - if stale, background revalidation
   * will refetch DNS/headers as needed.
   */
  getHosting: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getHosting } = await import("@/lib/db/repos/hosting");
      const { getDns } = await import("@/lib/db/repos/dns");
      const { getHeaders } = await import("@/lib/db/repos/headers");
      const { dnsWorkflow } = await import("@/workflows/dns");
      const { headersWorkflow } = await import("@/workflows/headers");
      const { hostingWorkflow } = await import("@/workflows/hosting");
      const { getDeduplicationKey, startWithDeduplication } = await import(
        "@/lib/workflow/deduplication"
      );

      // Check hosting cache first (with staleness)
      const cached = await getHosting(input.domain);

      // Fresh data - return immediately
      if (cached.data && !cached.stale) {
        return {
          success: true,
          cached: true,
          stale: false,
          data: cached.data,
        };
      }

      // Stale data - trigger background refresh and return stale
      if (cached.data && cached.stale) {
        // Fire-and-forget background revalidation
        void (async () => {
          try {
            // Fetch fresh DNS and headers
            const [dnsResult, headersResult] = await Promise.all([
              startWithDeduplication(
                getDeduplicationKey("dns", input.domain),
                async () => {
                  const run = await start(dnsWorkflow, [
                    { domain: input.domain },
                  ]);
                  return run.returnValue;
                },
              ),
              startWithDeduplication(
                getDeduplicationKey("headers", input.domain),
                async () => {
                  const run = await start(headersWorkflow, [
                    { domain: input.domain },
                  ]);
                  return run.returnValue;
                },
              ),
            ]);

            if (dnsResult.success || headersResult.success) {
              const dnsRecords = dnsResult.data?.records ?? [];
              const headers = headersResult.data?.headers ?? [];

              await startWithDeduplication(
                getDeduplicationKey("hosting", {
                  domain: input.domain,
                  dnsRecords,
                  headers,
                }),
                async () => {
                  const run = await start(hostingWorkflow, [
                    { domain: input.domain, dnsRecords, headers },
                  ]);
                  return run.returnValue;
                },
              );
            }
          } catch (err) {
            // Log and track - this is background work but failures may indicate systemic issues
            logger.error(
              { err, domain: input.domain, workflow: "hosting" },
              "background hosting revalidation failed",
            );
            analytics.trackException(
              err instanceof Error ? err : new Error(String(err)),
              { domain: input.domain, workflow: "hosting" },
            );
          }
        })();

        return {
          success: true,
          cached: true,
          stale: true,
          data: cached.data,
        };
      }

      // No cached data - orchestrate DNS → headers → hosting
      // First check if DNS/headers have cached data we can use
      const [dnsCached, headersCached] = await Promise.all([
        getDns(input.domain),
        getHeaders(input.domain),
      ]);

      // Track if we're using stale upstream data
      const usedStaleDns = dnsCached.data !== null && dnsCached.stale;
      const usedStaleHeaders =
        headersCached.data !== null && headersCached.stale;

      // Use cached DNS/headers if available (fresh or stale), otherwise fetch
      const dnsKey = getDeduplicationKey("dns", input.domain);
      const headersKey = getDeduplicationKey("headers", input.domain);

      const [dnsResult, headersResult] = await Promise.all([
        dnsCached.data
          ? Promise.resolve({ success: true, data: dnsCached.data })
          : startWithDeduplication(dnsKey, async () => {
              const run = await start(dnsWorkflow, [{ domain: input.domain }]);
              return run.returnValue;
            }),
        headersCached.data
          ? Promise.resolve({ success: true, data: headersCached.data })
          : startWithDeduplication(headersKey, async () => {
              const run = await start(headersWorkflow, [
                { domain: input.domain },
              ]);
              return run.returnValue;
            }),
      ]);

      // If both upstream workflows failed, we have no data to detect providers from
      if (!dnsResult.success && !headersResult.success) {
        return {
          success: false,
          error: "Failed to fetch DNS records and HTTP headers",
          data: null,
        };
      }

      // Guard against null data from failed workflows (partial data is okay)
      const dnsRecords = dnsResult.data?.records ?? [];
      const headers = headersResult.data?.headers ?? [];

      // Hosting workflow with deduplication
      const hostingKey = getDeduplicationKey("hosting", {
        domain: input.domain,
        dnsRecords,
        headers,
      });
      const result = await startWithDeduplication(hostingKey, async () => {
        const run = await start(hostingWorkflow, [
          { domain: input.domain, dnsRecords, headers },
        ]);
        return run.returnValue;
      });

      // Propagate staleness if we used stale upstream data
      const upstreamStale = usedStaleDns || usedStaleHeaders;

      if (result.success && result.data) {
        return {
          success: true,
          cached: false,
          stale: upstreamStale,
          data: result.data,
        };
      }

      // Access error from the failure case of the discriminated union
      const errorMessage =
        !result.success && "error" in result
          ? result.error
          : "Hosting workflow failed";

      return {
        success: false,
        error: errorMessage,
        data: null,
      };
    }),

  /**
   * Get SSL certificates for a domain using a durable workflow.
   * Performs TLS handshake with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getCertificates: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCertificates } = await import("@/lib/db/repos/certificates");
      const { certificatesWorkflow } = await import("@/workflows/certificates");

      return withSwrCache({
        workflowName: "certificates",
        domain: input.domain,
        getCached: () => getCertificates(input.domain),
        startWorkflow: () =>
          start(certificatesWorkflow, [{ domain: input.domain }]),
      });
    }),

  /**
   * Get HTTP headers for a domain using a durable workflow.
   * Probes the domain with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getHeaders: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getHeaders } = await import("@/lib/db/repos/headers");
      const { headersWorkflow } = await import("@/workflows/headers");

      return withSwrCache({
        workflowName: "headers",
        domain: input.domain,
        getCached: () => getHeaders(input.domain),
        startWorkflow: () => start(headersWorkflow, [{ domain: input.domain }]),
      });
    }),

  /**
   * Get SEO data for a domain using a durable workflow.
   * Fetches HTML, robots.txt, and OG images with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getSeo: domainProcedure.input(DomainInputSchema).query(async ({ input }) => {
    const { getSeo } = await import("@/lib/db/repos/seo");
    const { seoWorkflow } = await import("@/workflows/seo");

    return withSwrCache({
      workflowName: "seo",
      domain: input.domain,
      getCached: () => getSeo(input.domain),
      startWorkflow: () => start(seoWorkflow, [{ domain: input.domain }]),
    });
  }),

  /**
   * Get a favicon for a domain using a durable workflow.
   * Fetches from multiple sources with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getFavicon: publicProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getFavicon } = await import("@/lib/db/repos/favicons");
      const { faviconWorkflow } = await import("@/workflows/favicon");

      return withSwrCache({
        workflowName: "favicon",
        domain: input.domain,
        getCached: () => getFavicon(input.domain),
        startWorkflow: () => start(faviconWorkflow, [{ domain: input.domain }]),
      });
    }),
});
