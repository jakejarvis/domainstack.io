import z from "zod";
import { normalizeDomainInput } from "@/lib/domain";
import { toRegistrableDomain } from "@/lib/domain-server";
import {
  CertificatesSchema,
  DnsResolveResultSchema,
  HostingSchema,
  HttpHeadersResponseSchema,
  PricingSchema,
  RegistrationSchema,
  SeoResponseSchema,
  StorageUrlSchema,
} from "@/lib/schemas";
import { getCertificates } from "@/server/services/certificates";
import { resolveAll } from "@/server/services/dns";
import { getOrCreateFaviconBlobUrl } from "@/server/services/favicon";
import { probeHeaders } from "@/server/services/headers";
import { detectHosting } from "@/server/services/hosting";
import { getPricing } from "@/server/services/pricing";
import { getRegistration } from "@/server/services/registration";
import { getOrCreateScreenshotBlobUrl } from "@/server/services/screenshot";
import { getSeo } from "@/server/services/seo";
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
} from "@/trpc/init";

const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => ({ domain: normalizeDomainInput(domain) }))
  .refine(({ domain }) => toRegistrableDomain(domain) !== null, {
    message: "Invalid domain",
    path: ["domain"],
  });

export const domainRouter = createTRPCRouter({
  registration: domainProcedure
    .input(DomainInputSchema)
    .output(RegistrationSchema)
    .query(({ input }) => getRegistration(input.domain)),
  dns: domainProcedure
    .input(DomainInputSchema)
    .output(DnsResolveResultSchema)
    .query(({ input }) => resolveAll(input.domain)),
  hosting: domainProcedure
    .input(DomainInputSchema)
    .output(HostingSchema)
    .query(({ input }) => detectHosting(input.domain)),
  certificates: domainProcedure
    .input(DomainInputSchema)
    .output(CertificatesSchema)
    .query(({ input }) => getCertificates(input.domain)),
  headers: domainProcedure
    .input(DomainInputSchema)
    .output(HttpHeadersResponseSchema)
    .query(({ input }) => probeHeaders(input.domain)),
  seo: domainProcedure
    .input(DomainInputSchema)
    .output(SeoResponseSchema)
    .query(({ input }) => getSeo(input.domain)),
  favicon: publicProcedure
    .input(DomainInputSchema)
    .output(StorageUrlSchema)
    .query(({ input }) => getOrCreateFaviconBlobUrl(input.domain)),
  screenshot: publicProcedure
    .input(DomainInputSchema)
    .output(StorageUrlSchema)
    .query(({ input }) => getOrCreateScreenshotBlobUrl(input.domain)),
  pricing: publicProcedure
    .input(DomainInputSchema)
    .output(PricingSchema)
    .query(({ input }) => getPricing(input.domain)),
});
