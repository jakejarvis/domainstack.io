import { z } from "zod";
import { ProviderRefSchema } from "@/lib/schemas/internal/provider";

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

// Registration availability status
export const RegistrationStatusEnumSchema = z.enum([
  "registered", // Domain is confirmed registered with valid WHOIS/RDAP data
  "unregistered", // Domain is confirmed unregistered (available for registration)
  "unknown", // WHOIS/RDAP lookup failed - status cannot be determined
]);

// https://github.com/jakejarvis/rdapper/blob/main/src/types.ts
export const RegistrationResponseSchema = z
  .object({
    domain: z.string(),
    tld: z.string(),
    isRegistered: z.boolean(), // Kept for backward compatibility
    status: RegistrationStatusEnumSchema, // Explicit status (preferred over isRegistered)
    unavailableReason: z.enum(["unsupported_tld", "timeout"]).optional(), // Present when status is "unknown"
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
  })
  .refine(
    (data) => {
      // Enforce consistency between status and isRegistered
      if (data.status === "registered" && !data.isRegistered) {
        return false;
      }
      if (data.status === "unregistered" && data.isRegistered) {
        return false;
      }
      if (data.status === "unknown" && data.isRegistered) {
        return false;
      }
      return true;
    },
    {
      message:
        'status and isRegistered must be consistent: status="registered" requires isRegistered=true, status="unknown" requires isRegistered=false',
    },
  )
  .refine(
    (data) => {
      // Enforce unavailableReason is only present when status is "unknown"
      if (data.status === "unknown" && data.unavailableReason === undefined) {
        return false;
      }
      if (data.status !== "unknown" && data.unavailableReason !== undefined) {
        return false;
      }
      return true;
    },
    {
      message:
        'unavailableReason must be present when status="unknown" and absent otherwise',
    },
  );

// Extract nameservers schema for reuse
export const RegistrationNameserverSchema = z.object({
  host: z.string(),
  ipv4: z.array(z.string()).optional(),
  ipv6: z.array(z.string()).optional(),
});
export const RegistrationNameserversSchema = z.array(
  RegistrationNameserverSchema,
);

export type RegistrationResponse = z.infer<typeof RegistrationResponseSchema>;
export type RegistrationStatusEnum = z.infer<
  typeof RegistrationStatusEnumSchema
>;
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
