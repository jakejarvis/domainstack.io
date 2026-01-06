import { z } from "zod";

/**
 * Registration source enum schema.
 * Source of truth - db/schema.ts derives pgEnum from this.
 */
export const RegistrationSourceSchema = z.enum(["rdap", "whois"]);
export type RegistrationSource = z.infer<typeof RegistrationSourceSchema>;
