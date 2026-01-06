import { z } from "zod";

/**
 * Provider category enum schema.
 * Source of truth - db/schema.ts derives pgEnum from this.
 */
export const ProviderCategorySchema = z.enum([
  "hosting",
  "email",
  "dns",
  "ca",
  "registrar",
]);
export type ProviderCategory = z.infer<typeof ProviderCategorySchema>;
