import { z } from "zod";

/**
 * Registration contact schemas.
 * Used in both provider.ts and registration.ts.
 */
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
export type RegistrationContact = z.infer<typeof RegistrationContactSchema>;

export const RegistrationContactsSchema = z.array(RegistrationContactSchema);
export type RegistrationContacts = z.infer<typeof RegistrationContactsSchema>;
