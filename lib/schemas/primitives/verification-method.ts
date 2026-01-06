import { z } from "zod";

/**
 * Verification method enum schema.
 * Source of truth - db/schema.ts derives pgEnum from this.
 */
export const VerificationMethodSchema = z.enum([
  "dns_txt",
  "html_file",
  "meta_tag",
]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;
