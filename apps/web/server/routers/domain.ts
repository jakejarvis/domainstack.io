import {
  MAX_AGE_CERTIFICATES,
  MAX_AGE_DNS,
  MAX_AGE_HEADERS,
  MAX_AGE_HOSTING,
  MAX_AGE_REGISTRATION,
  MAX_AGE_SEO,
} from "@domainstack/constants";
import { createLogger } from "@domainstack/logger";
import { fetchDns, fetchRegistration } from "@domainstack/server";
import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { start } from "workflow/api";
import z from "zod";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import { withSwrCache } from "@/lib/workflow/swr";
import {
  createTRPCRouter,
  publicProcedure,
  withDomainAccessUpdate,
  withRateLimit,
} from "@/trpc/init";

const logger = createLogger({ source: "domain-router" });

const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => {
    const registrable = toRegistrableDomain(domain);
    if (!registrable) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          '"domain" must be a valid registrable domain (e.g., example.com)',
      });
    }
    return { domain: registrable };
  });

export const domainRouter = createTRPCRouter({
  /**
   * Get registration data for a domain.
   * Performs WHOIS/RDAP lookup. Transient errors throw for TanStack Query to retry.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getRegistration: publicProcedure
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedRegistration } = await import("@domainstack/db/queries");

      // Check cache first
      const cached = await getCachedRegistration(input.domain);

      // Fresh data - return immediately
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, stale: false, data: cached.data };
      }

      // Stale data - check if acceptable
      if (cached.data && cached.stale) {
        const isTooOld =
          cached.fetchedAt !== null &&
          Date.now() - cached.fetchedAt.getTime() > MAX_AGE_REGISTRATION;

        if (!isTooOld) {
          // Return stale, trigger background refresh
          after(async () => {
            try {
              await fetchRegistration(input.domain);
            } catch (err) {
              logger.error(
                { domain: input.domain, err },
                "background registration refresh failed",
              );
            }
          });
          return {
            success: true,
            cached: true,
            stale: true,
            data: cached.data,
          };
        }
      }

      // Cache miss or too stale - fetch fresh and wait
      try {
        const result = await fetchRegistration(input.domain);

        if (result.success === false) {
          return {
            success: false,
            cached: false,
            stale: false,
            data: null,
            error: result.error,
          };
        }

        return {
          success: true,
          cached: false,
          stale: false,
          data: result.data,
        };
      } catch (err) {
        logger.error(
          { domain: input.domain, err },
          "registration fetch failed",
        );
        return {
          success: false,
          cached: false,
          stale: false,
          data: null,
          error: "lookup_failed",
        };
      }
    }),

  /**
   * Get DNS records for a domain.
   * Queries multiple DoH providers with automatic fallback.
   * Transient errors throw for TanStack Query to retry.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getDnsRecords: publicProcedure
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 60, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedDns } = await import("@domainstack/db/queries");

      // Check cache first
      const cached = await getCachedDns(input.domain);

      // Fresh data - return immediately
      if (cached.data && !cached.stale) {
        return { success: true, cached: true, stale: false, data: cached.data };
      }

      // Stale data - check if acceptable
      if (cached.data && cached.stale) {
        const isTooOld =
          cached.fetchedAt !== null &&
          Date.now() - cached.fetchedAt.getTime() > MAX_AGE_DNS;

        if (!isTooOld) {
          // Return stale, trigger background refresh
          after(async () => {
            try {
              await fetchDns(input.domain);
            } catch (err) {
              logger.error(
                { domain: input.domain, err },
                "background dns refresh failed",
              );
            }
          });
          return {
            success: true,
            cached: true,
            stale: true,
            data: cached.data,
          };
        }
      }

      // Cache miss or too stale - fetch fresh and wait
      try {
        const result = await fetchDns(input.domain);
        return {
          success: true,
          cached: false,
          stale: false,
          data: result.data,
        };
      } catch (err) {
        logger.error({ domain: input.domain, err }, "dns fetch failed");
        return {
          success: false,
          cached: false,
          stale: false,
          data: null,
          error: "dns_fetch_failed",
        };
      }
    }),

  /**
   * Get hosting, DNS, and email provider data for a domain.
   * Detects providers from DNS records and HTTP headers.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   *
   * Uses the hostingWorkflow which handles the full dependency chain
   * (DNS → headers → hosting) with proper durability and error handling.
   */
  getHosting: publicProcedure
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedHosting } = await import("@domainstack/db/queries");
      const { hostingWorkflow } = await import("@/workflows/hosting");

      return withSwrCache({
        domain: input.domain,
        getCached: () => getCachedHosting(input.domain),
        startWorkflow: () => start(hostingWorkflow, [{ domain: input.domain }]),
        workflowName: "hosting",
        maxAgeMs: MAX_AGE_HOSTING,
      });
    }),

  /**
   * Get SSL certificates for a domain using a durable workflow.
   * Performs TLS handshake with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getCertificates: publicProcedure
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedCertificates } = await import("@domainstack/db/queries");
      const { certificatesWorkflow } = await import("@/workflows/certificates");

      return withSwrCache({
        workflowName: "certificates",
        domain: input.domain,
        getCached: () => getCachedCertificates(input.domain),
        startWorkflow: () =>
          start(certificatesWorkflow, [{ domain: input.domain }]),
        maxAgeMs: MAX_AGE_CERTIFICATES,
      });
    }),

  /**
   * Get HTTP headers for a domain using a durable workflow.
   * Probes the domain with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getHeaders: publicProcedure
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 60, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedHeaders } = await import("@domainstack/db/queries");
      const { headersWorkflow } = await import("@/workflows/headers");

      return withSwrCache({
        workflowName: "headers",
        domain: input.domain,
        getCached: () => getCachedHeaders(input.domain),
        startWorkflow: () => start(headersWorkflow, [{ domain: input.domain }]),
        maxAgeMs: MAX_AGE_HEADERS,
      });
    }),

  /**
   * Get SEO data for a domain using a durable workflow.
   * Fetches HTML, robots.txt, and OG images with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getSeo: publicProcedure
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedSeo } = await import("@domainstack/db/queries");
      const { seoWorkflow } = await import("@/workflows/seo");

      return withSwrCache({
        workflowName: "seo",
        domain: input.domain,
        getCached: () => getCachedSeo(input.domain),
        startWorkflow: () => start(seoWorkflow, [{ domain: input.domain }]),
        maxAgeMs: MAX_AGE_SEO,
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
      const { getFavicon } = await import("@domainstack/db/queries");
      const { faviconWorkflow } = await import("@/workflows/favicon");

      return withSwrCache({
        workflowName: "favicon",
        domain: input.domain,
        getCached: () => getFavicon(input.domain),
        startWorkflow: () => start(faviconWorkflow, [{ domain: input.domain }]),
      });
    }),
});
