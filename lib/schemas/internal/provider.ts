import { z } from "zod";
import { ProviderCategorySchema, ProviderSourceSchema } from "@/lib/db/zod";
import { RuleSchema } from "../../providers/rules";
import { DnsRecordSchema } from "../domain/dns";
import { RegistrationContactsSchema } from "../domain/registration";

export { ProviderCategorySchema };
export type ProviderCategory = z.infer<typeof ProviderCategorySchema>;

export { ProviderSourceSchema };
export type ProviderSource = z.infer<typeof ProviderSourceSchema>;

export const ProviderSchema = z.object({
  name: z.string(),
  domain: z.string(),
  rule: RuleSchema,
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

export const ProviderRefSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().nullable(),
  domain: z.string().nullable(),
});
export type ProviderRef = z.infer<typeof ProviderRefSchema>;
