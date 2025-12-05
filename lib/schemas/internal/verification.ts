import { z } from "zod";
import { verificationMethod } from "@/lib/db/schema";

/**
 * Zod schema for verification methods, derived from the database enum
 * to ensure type safety and prevent drift between validation and DB layer.
 */
export const VerificationMethodSchema = z.enum(verificationMethod.enumValues);

export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

/**
 * DNS TXT record verification instructions
 */
export const DnsInstructionsSchema = z.object({
  title: z.string(),
  description: z.string(),
  hostname: z.string(),
  recordType: z.literal("TXT"),
  value: z.string(),
  suggestedTTL: z.number(),
  suggestedTTLLabel: z.string(),
});

export type DnsInstructions = z.infer<typeof DnsInstructionsSchema>;

/**
 * HTML file verification instructions
 */
export const HtmlFileInstructionsSchema = z.object({
  title: z.string(),
  description: z.string(),
  fullPath: z.string(),
  filename: z.string(),
  fileContent: z.string(),
});

export type HtmlFileInstructions = z.infer<typeof HtmlFileInstructionsSchema>;

/**
 * Meta tag verification instructions
 */
export const MetaTagInstructionsSchema = z.object({
  title: z.string(),
  description: z.string(),
  metaTag: z.string(),
});

export type MetaTagInstructions = z.infer<typeof MetaTagInstructionsSchema>;

/**
 * All verification instructions combined
 */
export const VerificationInstructionsSchema = z.object({
  dns_txt: DnsInstructionsSchema,
  html_file: HtmlFileInstructionsSchema,
  meta_tag: MetaTagInstructionsSchema,
});

export type VerificationInstructions = z.infer<
  typeof VerificationInstructionsSchema
>;
