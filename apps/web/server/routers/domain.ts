import {
  MAX_AGE_CERTIFICATES,
  MAX_AGE_DNS,
  MAX_AGE_HEADERS,
  MAX_AGE_HOSTING,
  MAX_AGE_REGISTRATION,
  MAX_AGE_SEO,
} from "@domainstack/constants";
import { TRPCError } from "@trpc/server";
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
   * Get registration data for a domain using a durable workflow.
   * Performs WHOIS/RDAP lookup with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getRegistration: publicProcedure
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 30, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { registrationsRepo } = await import("@/lib/db/repos");
      const { registrationWorkflow } = await import("@/workflows/registration");

      return withSwrCache({
        workflowName: "registration",
        domain: input.domain,
        getCached: () => registrationsRepo.getCachedRegistration(input.domain),
        startWorkflow: () =>
          start(registrationWorkflow, [{ domain: input.domain }]),
        maxAgeMs: MAX_AGE_REGISTRATION,
      });
    }),

  /**
   * Get DNS records for a domain using a durable workflow.
   * Queries multiple DoH providers with automatic fallback.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getDnsRecords: publicProcedure
    .use(withRateLimit)
    .use(withDomainAccessUpdate)
    .meta({ rateLimit: { requests: 60, window: "1 m" } })
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { dnsRepo } = await import("@/lib/db/repos");
      const { dnsWorkflow } = await import("@/workflows/dns");

      return withSwrCache({
        workflowName: "dns",
        domain: input.domain,
        getCached: () => dnsRepo.getCachedDns(input.domain),
        startWorkflow: () => start(dnsWorkflow, [{ domain: input.domain }]),
        maxAgeMs: MAX_AGE_DNS,
      });
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
      const { hostingRepo } = await import("@/lib/db/repos");
      const { hostingWorkflow } = await import("@/workflows/hosting");

      return withSwrCache({
        domain: input.domain,
        getCached: () => hostingRepo.getCachedHosting(input.domain),
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
      const { certificatesRepo } = await import("@/lib/db/repos");
      const { certificatesWorkflow } = await import("@/workflows/certificates");

      return withSwrCache({
        workflowName: "certificates",
        domain: input.domain,
        getCached: () => certificatesRepo.getCachedCertificates(input.domain),
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
      const { headersRepo } = await import("@/lib/db/repos");
      const { headersWorkflow } = await import("@/workflows/headers");

      return withSwrCache({
        workflowName: "headers",
        domain: input.domain,
        getCached: () => headersRepo.getCachedHeaders(input.domain),
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
      const { seoRepo } = await import("@/lib/db/repos");
      const { seoWorkflow } = await import("@/workflows/seo");

      return withSwrCache({
        workflowName: "seo",
        domain: input.domain,
        getCached: () => seoRepo.getCachedSeo(input.domain),
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
      const { faviconsRepo } = await import("@/lib/db/repos");
      const { faviconWorkflow } = await import("@/workflows/favicon");

      return withSwrCache({
        workflowName: "favicon",
        domain: input.domain,
        getCached: () => faviconsRepo.getFavicon(input.domain),
        startWorkflow: () => start(faviconWorkflow, [{ domain: input.domain }]),
      });
    }),
});
