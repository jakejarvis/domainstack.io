import { z } from "zod";

/**
 * Provider source enum schema.
 * Source of truth - db/schema.ts derives pgEnum from this.
 */
export const ProviderSourceSchema = z.enum(["catalog", "discovered"]);
export type ProviderSource = z.infer<typeof ProviderSourceSchema>;
