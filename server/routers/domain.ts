import { TRPCError } from "@trpc/server";
import { start } from "workflow/api";
import z from "zod";
import { toRegistrableDomain } from "@/lib/domain-server";
import { createLogger } from "@/lib/logger/server";
import {
  BlobUrlResponseSchema,
  BlobUrlWithBlockedFlagResponseSchema,
  CertificatesResponseSchema,
  DnsRecordsResponseSchema,
  HeadersResponseSchema,
  HostingResponseSchema,
  RegistrationResponseSchema,
  SeoResponseSchema,
} from "@/lib/schemas";
import { getDnsRecords } from "@/server/services/dns";
import { getHeaders } from "@/server/services/headers";
import { getHosting } from "@/server/services/hosting";
import { getSeo } from "@/server/services/seo";
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
} from "@/trpc/init";
import { certificatesWorkflow } from "@/workflows/certificates";
import { faviconWorkflow } from "@/workflows/favicon";
import { registrationWorkflow } from "@/workflows/registration";
import { screenshotWorkflow } from "@/workflows/screenshot";

const logger = createLogger({ source: "domain-router" });

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
    .output(RegistrationResponseSchema)
    .query(async ({ input }) => {
      try {
        const run = await start(registrationWorkflow, [
          { domain: input.domain },
        ]);

        logger.debug(
          { domain: input.domain, runId: run.runId },
          "registration workflow started",
        );

        const result = await run.returnValue;

        logger.debug(
          { domain: input.domain, runId: run.runId, cached: result.cached },
          "registration workflow completed",
        );

        if (result.success) {
          return result.data;
        }

        // Return error response for failed lookups
        if (result.data) {
          return result.data;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Registration lookup failed: ${result.error}`,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;

        logger.error(
          { err, domain: input.domain },
          "registration workflow failed",
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Registration lookup failed",
        });
      }
    }),

  getDnsRecords: domainProcedure
    .input(DomainInputSchema)
    .output(DnsRecordsResponseSchema)
    .query(({ input }) => getDnsRecords(input.domain)),

  getHosting: domainProcedure
    .input(DomainInputSchema)
    .output(HostingResponseSchema)
    .query(({ input }) => getHosting(input.domain)),

  /**
   * Get SSL certificates for a domain using a durable workflow.
   * Performs TLS handshake with automatic retries.
   */
  getCertificates: domainProcedure
    .input(DomainInputSchema)
    .output(CertificatesResponseSchema)
    .query(async ({ input }) => {
      try {
        const run = await start(certificatesWorkflow, [
          { domain: input.domain },
        ]);

        logger.debug(
          { domain: input.domain, runId: run.runId },
          "certificates workflow started",
        );

        const result = await run.returnValue;

        logger.debug(
          { domain: input.domain, runId: run.runId, cached: result.cached },
          "certificates workflow completed",
        );

        return result.data;
      } catch (err) {
        logger.error(
          { err, domain: input.domain },
          "certificates workflow failed",
        );
        return { certificates: [] };
      }
    }),

  getHeaders: domainProcedure
    .input(DomainInputSchema)
    .output(HeadersResponseSchema)
    .query(({ input }) => getHeaders(input.domain)),

  getSeo: domainProcedure
    .input(DomainInputSchema)
    .output(SeoResponseSchema)
    .query(({ input }) => getSeo(input.domain)),

  /**
   * Get a favicon for a domain using a durable workflow.
   * Fetches from multiple sources with automatic retries.
   */
  getFavicon: publicProcedure
    .input(DomainInputSchema)
    .output(BlobUrlResponseSchema)
    .query(async ({ input }) => {
      try {
        const run = await start(faviconWorkflow, [{ domain: input.domain }]);

        logger.debug(
          { domain: input.domain, runId: run.runId },
          "favicon workflow started",
        );

        const result = await run.returnValue;

        logger.debug(
          { domain: input.domain, runId: run.runId, cached: result.cached },
          "favicon workflow completed",
        );

        return { url: result.url };
      } catch (err) {
        logger.error({ err, domain: input.domain }, "favicon workflow failed");
        return { url: null };
      }
    }),

  /**
   * Get a screenshot for a domain using a durable workflow.
   * Captures with Puppeteer with automatic retries.
   */
  getScreenshot: publicProcedure
    .input(DomainInputSchema)
    .output(BlobUrlWithBlockedFlagResponseSchema)
    .query(async ({ input }) => {
      try {
        const run = await start(screenshotWorkflow, [{ domain: input.domain }]);

        logger.debug(
          { domain: input.domain, runId: run.runId },
          "screenshot workflow started",
        );

        const result = await run.returnValue;

        logger.debug(
          { domain: input.domain, runId: run.runId, cached: result.cached },
          "screenshot workflow completed",
        );

        return {
          url: result.url,
          ...(result.blocked && { blocked: true as const }),
        };
      } catch (err) {
        logger.error(
          { err, domain: input.domain },
          "screenshot workflow failed",
        );
        return { url: null };
      }
    }),
});
