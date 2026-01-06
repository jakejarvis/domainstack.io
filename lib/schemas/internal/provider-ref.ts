import { z } from "zod";

/**
 * Lightweight provider reference schema.
 * This is in a separate file to avoid circular dependencies between
 * provider.ts and registration.ts / certificates.ts.
 */
export const ProviderRefSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().nullable(),
  domain: z.string().nullable(),
});
export type ProviderRef = z.infer<typeof ProviderRefSchema>;
