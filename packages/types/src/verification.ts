/**
 * Verification types - Plain TypeScript interfaces.
 */

import type { VerificationMethod } from "@domainstack/constants";

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

export interface ResumeDomainData {
  id: string;
  domainName: string;
  verificationToken: string;
  verificationMethod?: VerificationMethod | null;
}

/** Verification status for the current step (exposed for UI components) */
export type VerificationState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "failed"; error?: string };
