import { z } from "zod";
import {
  type ProviderCategory,
  ProviderCategorySchema,
  type ProviderSource,
  ProviderSourceSchema,
  RegistrationContactsSchema,
} from "@/lib/schemas/primitives";
import { DnsRecordSchema } from "../domain/dns";

// Re-export primitives for backwards compatibility
export { ProviderCategorySchema };
export type { ProviderCategory };

export { ProviderSourceSchema };
export type { ProviderSource };

export { type ProviderRef, ProviderRefSchema } from "@/lib/schemas/primitives";

/**
 * Provider schema without rule - the rule is a catalog concern,
 * not needed for the type used throughout most of the app.
 * The catalog parser extends this with rules when needed.
 */
export const ProviderSchema = z.object({
  name: z.string(),
  domain: z.string(),
  category: ProviderCategorySchema,
});
export type Provider = z.infer<typeof ProviderSchema>;

export const ProviderInfoSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  domain: z.string().nullable(),
  records: z.array(DnsRecordSchema).optional(),
  // Registrar-specific verification data (WHOIS/RDAP)
  whoisServer: z.string().nullable().optional(),
  rdapServers: z.array(z.string()).nullable().optional(),
  registrationSource: z.enum(["rdap", "whois"]).nullable().optional(),
  transferLock: z.boolean().nullable().optional(),
  registrantInfo: z
    .object({
      privacyEnabled: z.boolean().nullable(),
      contacts: RegistrationContactsSchema.nullable(),
    })
    .optional(),
  // CA-specific verification data
  certificateExpiryDate: z.date().nullable().optional(),
});
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;
