import { z } from "zod";

/**
 * Lightweight provider reference schema.
 * Used throughout the codebase for provider identification.
 */
export const ProviderRefSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().nullable(),
  domain: z.string().nullable(),
});
export type ProviderRef = z.infer<typeof ProviderRefSchema>;
