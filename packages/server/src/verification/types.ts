/**
 * Types for domain ownership verification.
 */

import type { VerificationMethod } from "@domainstack/constants";

/**
 * Result of a verification attempt.
 */
export interface VerificationResult {
  /** Whether the domain ownership was verified */
  verified: boolean;
  /** The method that succeeded, or null if verification failed */
  method: VerificationMethod | null;
}

/**
 * Options for verification functions that make HTTP requests.
 */
export interface VerificationHttpOptions {
  /** User-Agent header for HTTP requests */
  userAgent?: string;
}
