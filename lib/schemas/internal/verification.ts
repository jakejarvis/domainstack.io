import { z } from "zod";
import { verificationMethod } from "@/lib/db/schema";

/**
 * Zod schema for verification methods, derived from the database enum
 * to ensure type safety and prevent drift between validation and DB layer.
 */
export const VerificationMethodSchema = z.enum(verificationMethod.enumValues);

export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;
