import z from "zod";
import { normalizeDomainInput } from "@/lib/domain";
import { toRegistrableDomain } from "@/lib/domain-server";
import { rateLimitMiddleware } from "@/lib/ratelimit";
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
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

const DomainInputSchema = z
  .object({ domain: z.string().min(1) })
  .transform(({ domain }) => ({ domain: normalizeDomainInput(domain) }))
  .refine(({ domain }) => toRegistrableDomain(domain) !== null, {
    message: "Invalid domain",
    path: ["domain"],
  });

export const domainRouter = createTRPCRouter({
  registration: publicProcedure
    .meta({ service: "registration" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(RegistrationSchema)
    .query(({ input }) => getRegistration(input.domain)),
  pricing: publicProcedure
    .meta({ service: "pricing" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(PricingSchema)
    .query(({ input }) => getPricingForTld(input.domain)),
  dns: publicProcedure
    .meta({ service: "dns" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(DnsResolveResultSchema)
    .query(({ input }) => resolveAll(input.domain)),
  hosting: publicProcedure
    .meta({ service: "hosting" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(HostingSchema)
    .query(({ input }) => detectHosting(input.domain)),
  certificates: publicProcedure
    .meta({ service: "certs" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(CertificatesSchema)
    .query(({ input }) => getCertificates(input.domain)),
  headers: publicProcedure
    .meta({ service: "headers" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(HttpHeadersResponseSchema)
    .query(({ input }) => probeHeaders(input.domain)),
  seo: publicProcedure
    .meta({ service: "seo" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(SeoResponseSchema)
    .query(({ input }) => getSeo(input.domain)),
  favicon: publicProcedure
    .meta({ service: "favicon" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(StorageUrlSchema)
    .query(({ input }) => getOrCreateFaviconBlobUrl(input.domain)),
  screenshot: publicProcedure
    .meta({ service: "screenshot" })
    .use(rateLimitMiddleware)
    .input(DomainInputSchema)
    .output(StorageUrlSchema)
    .query(({ input }) => getOrCreateScreenshotBlobUrl(input.domain)),
});
