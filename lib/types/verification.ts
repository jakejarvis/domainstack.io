/**
 * Verification types - Plain TypeScript interfaces.
 */

import type {
  VERIFICATION_METHODS,
  VERIFICATION_STATUSES,
} from "@/lib/constants/verification";

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * Base verification instructions.
 */
interface BaseInstructions {
  title: string;
  description: string;
}

/**
 * DNS TXT record verification instructions.
 */
export interface DnsInstructions extends BaseInstructions {
  hostname: string;
  recordType: "TXT";
  value: string;
  suggestedTTL: number;
  suggestedTTLLabel: string;
}

/**
 * HTML file verification instructions.
 */
export interface HtmlFileInstructions extends BaseInstructions {
  hostname: string;
  fullPath: string;
  filename: string;
  fileContent: string;
}

/**
 * Meta tag verification instructions.
 */
export interface MetaTagInstructions extends BaseInstructions {
  metaTag: string;
}

/**
 * All verification instructions combined.
 */
export interface VerificationInstructions {
  dns_txt: DnsInstructions;
  html_file: HtmlFileInstructions;
  meta_tag: MetaTagInstructions;
}
