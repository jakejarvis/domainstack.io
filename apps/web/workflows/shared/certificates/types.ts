/**
 * Certificates shared step types.
 *
 * Internal types for step-to-step data transfer and typed errors.
 * Response types (CertificatesResponse) remain in lib/types/domain/certificates.ts.
 */

import type { Certificate } from "@domainstack/types";

/**
 * Typed error for certificates operations.
 * - dns_error: Domain does not resolve
 * - tls_error: SSL certificate is invalid
 *
 * Note: fetch_error and timeout are thrown as RetryableError and never returned.
 */
export type CertificatesError = "dns_error" | "tls_error";

/**
 * Internal data structure for step-to-step transfer after fetching.
 * Contains the raw chain JSON for serialization across step boundaries.
 */
export interface CertificatesFetchData {
  chainJson: string;
}

/**
 * Internal data structure for step-to-step transfer after processing.
 * Contains the processed certificates with provider IDs and expiry metadata.
 */
export interface CertificatesProcessedData {
  certificates: Certificate[];
  providerIds: (string | null)[];
  earliestValidTo: Date;
}

/**
 * Result of the certificates fetch step.
 * Discriminated union for type-safe error handling.
 */
export type FetchCertificatesResult =
  | { success: true; data: CertificatesFetchData }
  | { success: false; error: CertificatesError };
