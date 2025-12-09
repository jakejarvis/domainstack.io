import { z } from "zod";
import { ProviderRefSchema } from "@/lib/schemas/internal/provider";

export const CertificateSchema = z.object({
  issuer: z.string(),
  subject: z.string(),
  altNames: z.array(z.string()),
  validFrom: z.string(),
  validTo: z.string(),
  caProvider: ProviderRefSchema,
});

export const CertificatesResponseSchema = z.array(CertificateSchema);

export type Certificate = z.infer<typeof CertificateSchema>;
export type CertificatesResponse = z.infer<typeof CertificatesResponseSchema>;
