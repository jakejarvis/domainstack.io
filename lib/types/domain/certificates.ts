/**
 * Certificate types - Plain TypeScript interfaces.
 */

import type { ProviderRef } from "@/lib/types";

/**
 * A single SSL/TLS certificate.
 */
export interface Certificate {
  issuer: string;
  subject: string;
  altNames: string[];
  validFrom: string;
  validTo: string;
  caProvider: ProviderRef;
}

/**
 * Response from certificate chain fetch.
 */
export interface CertificatesResponse {
  certificates: Certificate[];
  error?: string;
}
