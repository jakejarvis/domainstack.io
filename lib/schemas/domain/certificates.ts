import { z } from "zod";
import { ProviderRefSchema } from "@/lib/schemas/internal/provider";

export const CertificateSchema = z.object({
  issuer: z.string(),
  subject: z.string(),
  altNames: z.array(z.string()),
  validFrom: z.string(),
  validTo: z.string(),
  caProvider: ProviderRefSchema,
  // Indicates if this certificate is currently expired
  // This allows us to show expired certs with appropriate UI warnings
  expired: z.boolean().optional(),
});

export const CertificatesResponseSchema = z.array(CertificateSchema);

export type Certificate = z.infer<typeof CertificateSchema>;
export type CertificatesResponse = z.infer<typeof CertificatesResponseSchema>;
