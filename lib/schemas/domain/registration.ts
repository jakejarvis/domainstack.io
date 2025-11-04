import { z } from "zod";
import { ProviderRefSchema } from "../internal/provider";

// Reusable sub-schemas to avoid duplication elsewhere
export const RegistrationStatusSchema = z.object({
  status: z.string(),
  description: z.string().optional(),
  raw: z.string().optional(),
});
export const RegistrationStatusesSchema = z.array(RegistrationStatusSchema);

export const RegistrationContactSchema = z.object({
  type: z.enum([
    "registrant",
    "admin",
    "tech",
    "billing",
    "abuse",
    "registrar",
    "reseller",
    "unknown",
  ]),
  name: z.string().optional(),
  organization: z.string().optional(),
  email: z.union([z.string(), z.array(z.string())]).optional(),
  phone: z.union([z.string(), z.array(z.string())]).optional(),
  fax: z.union([z.string(), z.array(z.string())]).optional(),
  street: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
});
export const RegistrationContactsSchema = z.array(RegistrationContactSchema);

export const RegistrationSourceSchema = z.enum(["rdap", "whois"]);

// https://github.com/jakejarvis/rdapper/blob/main/src/types.ts
export const RegistrationSchema = z.object({
  domain: z.string(),
  tld: z.string(),
  isRegistered: z.boolean(),
  unicodeName: z.string().optional(),
  punycodeName: z.string().optional(),
  registry: z.string().optional(),
  registrar: z
    .object({
      name: z.string().optional(),
      ianaId: z.string().optional(),
      url: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  reseller: z.string().optional(),
  statuses: RegistrationStatusesSchema.optional(),
  creationDate: z.string().optional(),
  updatedDate: z.string().optional(),
  expirationDate: z.string().optional(),
  deletionDate: z.string().optional(),
  transferLock: z.boolean().optional(),
  dnssec: z
    .object({
      enabled: z.boolean(),
      dsRecords: z
        .array(
          z.object({
            keyTag: z.number().optional(),
            algorithm: z.number().optional(),
            digestType: z.number().optional(),
            digest: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  nameservers: z
    .array(
      z.object({
        host: z.string(),
        ipv4: z.array(z.string()).optional(),
        ipv6: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  contacts: RegistrationContactsSchema.optional(),
  privacyEnabled: z.boolean().optional(),
  whoisServer: z.string().optional(),
  rdapServers: z.array(z.string()).optional(),
  source: z.enum(["rdap", "whois"]).nullable(),
  warnings: z.array(z.string()).optional(),

  registrarProvider: ProviderRefSchema,
});

// Extract nameservers schema for reuse
export const RegistrationNameserverSchema = z.object({
  host: z.string(),
  ipv4: z.array(z.string()).optional(),
  ipv6: z.array(z.string()).optional(),
});
export const RegistrationNameserversSchema = z.array(
  RegistrationNameserverSchema,
);

export type Registration = z.infer<typeof RegistrationSchema>;
export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>;
export type RegistrationStatuses = z.infer<typeof RegistrationStatusesSchema>;
export type RegistrationNameserver = z.infer<
  typeof RegistrationNameserverSchema
>;
export type RegistrationNameservers = z.infer<
  typeof RegistrationNameserversSchema
>;
export type RegistrationContact = z.infer<typeof RegistrationContactSchema>;
export type RegistrationContacts = z.infer<typeof RegistrationContactsSchema>;
export type RegistrationSource = z.infer<typeof RegistrationSourceSchema>;
