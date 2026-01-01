import { TRPCError } from "@trpc/server";
import z from "zod";
import { toRegistrableDomain } from "@/lib/domain-server";
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
import { getCertificates } from "@/server/services/certificates";
import { getDnsRecords } from "@/server/services/dns";
import { getHeaders } from "@/server/services/headers";
import { getHosting } from "@/server/services/hosting";
import { getFavicon } from "@/server/services/icons";
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
    .output(BlobUrlWithBlockedFlagResponseSchema)
    .query(({ input }) => getScreenshot(input.domain)),
});
