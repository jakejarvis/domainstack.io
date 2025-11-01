import { z } from "zod";
import { CertificateSchema } from "../domain/certificates";
import { DnsRecordSchema } from "../domain/dns";
import { HostingSchema } from "../domain/hosting";
import { HttpHeadersSchema } from "../domain/http";
import { RegistrationSchema } from "../domain/registration";
import { SeoResponseSchema } from "../domain/seo";

export const DomainExportSchema = z.object({
  domain: z.string(),
  registration: RegistrationSchema.omit({
    domain: true,
    unicodeName: true,
    punycodeName: true,
    warnings: true,
    registrarProvider: true,
  }).nullish(),
  dns: z
    .object({
      records: z.array(DnsRecordSchema.omit({ isCloudflare: true })),
      resolver: z.string(),
    })
    .nullish(),
  hosting: HostingSchema.transform((h) => ({
    dns: h.dnsProvider.name ?? "",
    hosting: h.hostingProvider.name ?? "",
    email: h.emailProvider.name ?? "",
    geo: h.geo,
  })).nullish(),
  certificates: z.array(CertificateSchema.omit({ caProvider: true })).nullish(),
  headers: HttpHeadersSchema.nullish(),
  seo: SeoResponseSchema.omit({
    preview: true,
    source: true,
    errors: true,
  }).nullish(),
});

export type DomainExport = z.infer<typeof DomainExportSchema>;
