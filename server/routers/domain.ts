import { TRPCError } from "@trpc/server";
import { start } from "workflow/api";
import z from "zod";
import { toRegistrableDomain } from "@/lib/normalize-domain";
import { withSwrCache } from "@/lib/workflow/swr";
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
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getRegistration: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedRegistration } = await import(
        "@/lib/db/repos/registrations"
      );
      const { registrationWorkflow } = await import("@/workflows/registration");

      return withSwrCache({
        workflowName: "registration",
        domain: input.domain,
        getCached: () => getCachedRegistration(input.domain),
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
      const { getCachedDns } = await import("@/lib/db/repos/dns");
      const { dnsWorkflow } = await import("@/workflows/dns");

      return withSwrCache({
        workflowName: "dns",
        domain: input.domain,
        getCached: () => getCachedDns(input.domain),
        startWorkflow: () => start(dnsWorkflow, [{ domain: input.domain }]),
      });
    }),

  /**
   * Get hosting, DNS, and email provider data for a domain.
   * Detects providers from DNS records and HTTP headers.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   *
   * Uses the hostingOrchestrationWorkflow which handles the full dependency chain
   * (DNS → headers → hosting) with proper durability and error handling.
   */
  getHosting: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedHosting } = await import("@/lib/db/repos/hosting");
      const { hostingOrchestrationWorkflow } = await import(
        "@/workflows/hosting-orchestration"
      );

      return withSwrCache({
        domain: input.domain,
        getCached: () => getCachedHosting(input.domain),
        startWorkflow: () =>
          start(hostingOrchestrationWorkflow, [{ domain: input.domain }]),
        workflowName: "hosting-orchestration",
      });
    }),

  /**
   * Get SSL certificates for a domain using a durable workflow.
   * Performs TLS handshake with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getCertificates: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const { getCachedCertificates } = await import(
        "@/lib/db/repos/certificates"
      );
      const { certificatesWorkflow } = await import("@/workflows/certificates");

      return withSwrCache({
        workflowName: "certificates",
        domain: input.domain,
        getCached: () => getCachedCertificates(input.domain),
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
      const { getCachedHeaders } = await import("@/lib/db/repos/headers");
      const { headersWorkflow } = await import("@/workflows/headers");

      return withSwrCache({
        workflowName: "headers",
        domain: input.domain,
        getCached: () => getCachedHeaders(input.domain),
        startWorkflow: () => start(headersWorkflow, [{ domain: input.domain }]),
      });
    }),

  /**
   * Get SEO data for a domain using a durable workflow.
   * Fetches HTML, robots.txt, and OG images with automatic retries.
   * Uses stale-while-revalidate: returns stale data immediately while refreshing in background.
   */
  getSeo: domainProcedure.input(DomainInputSchema).query(async ({ input }) => {
    const { getCachedSeo } = await import("@/lib/db/repos/seo");
    const { seoWorkflow } = await import("@/workflows/seo");

    return withSwrCache({
      workflowName: "seo",
      domain: input.domain,
      getCached: () => getCachedSeo(input.domain),
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
