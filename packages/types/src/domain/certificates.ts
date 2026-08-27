/**
 * Certificate types - Plain TypeScript interfaces.
 */

import type {
  CERTIFICATE_CHANGE_KINDS,
  NOTIFIABLE_CERTIFICATE_CHANGE_KINDS,
} from "@domainstack/constants";

import type { ProviderRef } from "./provider-ref";

export type CertificateChangeKind = (typeof CERTIFICATE_CHANGE_KINDS)[number];
export type NotifiableCertificateChangeKind = (typeof NOTIFIABLE_CERTIFICATE_CHANGE_KINDS)[number];

/**
 * A single SSL/TLS certificate.
 */
export interface Certificate {
  issuer: string;
  subject: string;
  altNames: string[];
  validFrom: string;
  validTo: string;
  fingerprint256: string | null;
  serialNumber: string | null;
  caProvider: ProviderRef;
}

/**
 * Response from certificate chain fetch.
 */
export interface CertificatesResponse {
  certificates: Certificate[];
  error?: string;
}

/**
 * In-flight certificate observation awaiting confirmation.
 */
export interface CertificatePendingObservation {
  fingerprint: string | null;
  caProviderId: string | null;
  issuer: string;
  validTo: string;
  serialNumber?: string | null;
  firstSeenAt: string;
  observations: number;
}

/**
 * Previously committed certificate identity (flap memory).
 */
export interface CertificateRecentIdentity {
  fingerprint: string | null;
  caProviderId: string | null;
  serialNumber?: string | null;
  seenAt: string;
}

/**
 * Certificate snapshot data stored on `domain_snapshots.certificate`.
 */
export interface CertificateSnapshotData {
  caProviderId: string | null;
  issuer: string;
  validTo: string;
  fingerprint: string | null;
  serialNumber?: string | null;
  pending?: CertificatePendingObservation | null;
  recent?: CertificateRecentIdentity[];
}
