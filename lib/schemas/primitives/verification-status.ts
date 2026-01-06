import { z } from "zod";

/**
 * Verification status enum schema.
 * Source of truth - db/schema.ts derives pgEnum from this.
 */
export const VerificationStatusSchema = z.enum([
  "verified",
  "failing",
  "unverified",
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
