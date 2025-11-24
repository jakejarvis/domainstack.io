import { TRPCError } from "@trpc/server";
import z from "zod";
import { normalizeDomainInput } from "@/lib/domain";
import { toRegistrableDomain } from "@/lib/domain-server";
import {
  BlobUrlResponseSchema,
  CertificatesResponseSchema,
  DnsRecordsResponseSchema,
  HeadersResponseSchema,
  HostingResponseSchema,
  PricingResponseSchema,
  RegistrationResponseSchema,
  SeoResponseSchema,
} from "@/lib/schemas";
import { getCertificates } from "@/server/services/certificates";
import { getDnsRecords } from "@/server/services/dns";
import { getFavicon } from "@/server/services/favicon";
import { getHeaders } from "@/server/services/headers";
import { getHosting } from "@/server/services/hosting";
import { getPricing } from "@/server/services/pricing";
import { getRegistration } from "@/server/services/registration";
import { getScreenshot } from "@/server/services/screenshot";
import { getSeo } from "@/server/services/seo";
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
} from "@/trpc/init";

const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => {
    const normalized = normalizeDomainInput(domain);
    const registrable = toRegistrableDomain(normalized);
    if (!registrable) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: '"domain" must be a valid and registrable',
      });
    }
    return { domain: registrable };
  });

export const domainRouter = createTRPCRouter({
  getRegistration: domainProcedure
    .input(DomainInputSchema)
    .output(RegistrationResponseSchema)
    .query(({ input }) => getRegistration(input.domain)),
  getDnsRecords: domainProcedure
    .input(DomainInputSchema)
    .output(DnsRecordsResponseSchema)
    .query(({ input }) => getDnsRecords(input.domain)),
  getHosting: domainProcedure
    .input(DomainInputSchema)
    .output(HostingResponseSchema)
    .query(({ input }) => getHosting(input.domain)),
  getCertificates: domainProcedure
    .input(DomainInputSchema)
    .output(CertificatesResponseSchema)
    .query(({ input }) => getCertificates(input.domain)),
  getHeaders: domainProcedure
    .input(DomainInputSchema)
    .output(HeadersResponseSchema)
    .query(({ input }) => getHeaders(input.domain)),
  getSeo: domainProcedure
    .input(DomainInputSchema)
    .output(SeoResponseSchema)
    .query(({ input }) => getSeo(input.domain)),
  getFavicon: publicProcedure
    .input(DomainInputSchema)
    .output(BlobUrlResponseSchema)
    .query(({ input }) => getFavicon(input.domain)),
  getScreenshot: publicProcedure
    .input(DomainInputSchema)
    .output(BlobUrlResponseSchema)
    .query(({ input }) => getScreenshot(input.domain)),
  getPricing: publicProcedure
    .input(DomainInputSchema)
    .output(PricingResponseSchema)
    .query(({ input }) => getPricing(input.domain)),
});
