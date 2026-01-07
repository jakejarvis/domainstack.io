import { TRPCError } from "@trpc/server";
import { start } from "workflow/api";
import z from "zod";
import { toRegistrableDomain } from "@/lib/domain-server";
import { getHosting } from "@/server/services/hosting";
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
} from "@/trpc/init";
import { certificatesWorkflow } from "@/workflows/certificates";
import { dnsWorkflow } from "@/workflows/dns";
import { faviconWorkflow } from "@/workflows/favicon";
import { headersWorkflow } from "@/workflows/headers";
import { registrationWorkflow } from "@/workflows/registration";
import { screenshotWorkflow } from "@/workflows/screenshot";
import { seoWorkflow } from "@/workflows/seo";

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
      const run = await start(registrationWorkflow, [{ domain: input.domain }]);
      return await run.returnValue;
    }),

  /**
   * Get DNS records for a domain using a durable workflow.
   * Queries multiple DoH providers with automatic fallback.
   */
  getDnsRecords: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const run = await start(dnsWorkflow, [{ domain: input.domain }]);
      return await run.returnValue;
    }),

  getHosting: domainProcedure
    .input(DomainInputSchema)
    .query(({ input }) => getHosting(input.domain)),

  /**
   * Get SSL certificates for a domain using a durable workflow.
   * Performs TLS handshake with automatic retries.
   */
  getCertificates: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const run = await start(certificatesWorkflow, [{ domain: input.domain }]);
      return await run.returnValue;
    }),

  /**
   * Get HTTP headers for a domain using a durable workflow.
   * Probes the domain with automatic retries.
   */
  getHeaders: domainProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const run = await start(headersWorkflow, [{ domain: input.domain }]);
      return await run.returnValue;
    }),

  /**
   * Get SEO data for a domain using a durable workflow.
   * Fetches HTML, robots.txt, and OG images with automatic retries.
   */
  getSeo: domainProcedure.input(DomainInputSchema).query(async ({ input }) => {
    const run = await start(seoWorkflow, [{ domain: input.domain }]);
    return await run.returnValue;
  }),

  /**
   * Get a favicon for a domain using a durable workflow.
   * Fetches from multiple sources with automatic retries.
   */
  getFavicon: publicProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const run = await start(faviconWorkflow, [{ domain: input.domain }]);
      return await run.returnValue;
    }),

  /**
   * Get a screenshot for a domain using a durable workflow.
   * Captures with Puppeteer with automatic retries.
   */
  getScreenshot: publicProcedure
    .input(DomainInputSchema)
    .query(async ({ input }) => {
      const run = await start(screenshotWorkflow, [{ domain: input.domain }]);
      return await run.returnValue;
    }),
});
