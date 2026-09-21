/**
 * Verification types - Plain TypeScript interfaces.
 */

import type { VerificationMethod } from "./primitives";

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
export type VerificationState = { status: "idle" } | { status: "verifying" } | { status: "failed" };

/**
 * Result of a domain ownership verification attempt.
 */
export interface VerificationResult {
  verified: boolean;
  method: VerificationMethod | null;
  /**
   * True when the probe itself could not complete (network/DNS/timeout
   * error) rather than confirming the proof is absent. Always paired with
   * `verified: false`. Callers that gate a state transition on a *confirmed*
   * failure (e.g. a grace-period countdown before revoking verification)
   * must treat this the same as "couldn't check, try again later" — never
   * as evidence the domain actually removed its ownership proof.
   */
  checkFailed?: boolean;
}
