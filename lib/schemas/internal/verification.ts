import { z } from "zod";
import {
  VerificationMethodSchema,
  VerificationStatusSchema,
} from "@/lib/db/zod";

// Export the schema for use in other files
export { VerificationMethodSchema, VerificationStatusSchema };
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

const BaseInstructionsSchema = z.object({
  title: z.string(),
  description: z.string(),
});

/**
 * DNS TXT record verification instructions
 */
export const DnsInstructionsSchema = BaseInstructionsSchema.extend({
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
export const HtmlFileInstructionsSchema = BaseInstructionsSchema.extend({
  hostname: z.string(),
  fullPath: z.string(),
  filename: z.string(),
  fileContent: z.string(),
});

export type HtmlFileInstructions = z.infer<typeof HtmlFileInstructionsSchema>;

/**
 * Meta tag verification instructions
 */
export const MetaTagInstructionsSchema = BaseInstructionsSchema.extend({
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
