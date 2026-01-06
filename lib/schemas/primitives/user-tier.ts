import { z } from "zod";

/**
 * User tier enum schema.
 * Source of truth - db/schema.ts derives pgEnum from this.
 */
export const UserTierSchema = z.enum(["free", "pro"]);
export type UserTier = z.infer<typeof UserTierSchema>;
