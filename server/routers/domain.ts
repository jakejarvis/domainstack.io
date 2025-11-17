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
import { getPricingForTld } from "@/server/services/pricing";
import { getRegistration } from "@/server/services/registration";
import { getOrCreateScreenshotBlobUrl } from "@/server/services/screenshot";
import { getSeo } from "@/server/services/seo";
import { createTRPCRouter, domainProcedure } from "@/trpc/init";

const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => ({ domain: normalizeDomainInput(domain) }))
  .refine(({ domain }) => toRegistrableDomain(domain) !== null, {
    message: "Invalid domain",
    path: ["domain"],
  });

export const domainRouter = createTRPCRouter({
  registration: domainProcedure
    .meta({ service: "registration" })
    .input(DomainInputSchema)
    .output(RegistrationSchema)
    .query(({ input }) => getRegistration(input.domain)),
  dns: domainProcedure
    .meta({ service: "dns" })
    .input(DomainInputSchema)
    .output(DnsResolveResultSchema)
    .query(({ input }) => resolveAll(input.domain)),
  hosting: domainProcedure
    .meta({ service: "hosting" })
    .input(DomainInputSchema)
    .output(HostingSchema)
    .query(({ input }) => detectHosting(input.domain)),
  certificates: domainProcedure
    .meta({ service: "certs" })
    .input(DomainInputSchema)
    .output(CertificatesSchema)
    .query(({ input }) => getCertificates(input.domain)),
  headers: domainProcedure
    .meta({ service: "headers" })
    .input(DomainInputSchema)
    .output(HttpHeadersResponseSchema)
    .query(({ input }) => probeHeaders(input.domain)),
  seo: domainProcedure
    .meta({ service: "seo" })
    .input(DomainInputSchema)
    .output(SeoResponseSchema)
    .query(({ input }) => getSeo(input.domain)),
  favicon: domainProcedure
    .meta({ service: "favicon", recordAccess: false })
    .input(DomainInputSchema)
    .output(StorageUrlSchema)
    .query(({ input }) => getOrCreateFaviconBlobUrl(input.domain)),
  screenshot: domainProcedure
    .meta({ service: "screenshot", recordAccess: false })
    .input(DomainInputSchema)
    .output(StorageUrlSchema)
    .query(({ input }) => getOrCreateScreenshotBlobUrl(input.domain)),
  pricing: domainProcedure
    .meta({ service: "pricing", recordAccess: false })
    .input(DomainInputSchema)
    .output(PricingSchema)
    .query(({ input }) => getPricingForTld(input.domain)),
});
