/**
 * Change detection types for domain monitoring.
 *
 * These types represent the changes detected when comparing
 * domain snapshots over time.
 */

import type { CertificateChangeKind, CertificateSnapshotData } from "@domainstack/types";

/**
 * Registration change details.
 */
export interface RegistrationChange {
  registrarChanged: boolean;
  nameserversChanged: boolean;
  transferLockChanged: boolean;
  statusesChanged: boolean;
  previousRegistrar: string | null;
  previousNameservers: { host: string }[];
  previousTransferLock: boolean | null;
  previousStatuses: string[];
  newRegistrar: string | null;
  newNameservers: { host: string }[];
  newTransferLock: boolean | null;
  newStatuses: string[];
}

/**
 * Provider change details.
 */
export interface ProviderChange {
  dnsProviderChanged: boolean;
  hostingProviderChanged: boolean;
  emailProviderChanged: boolean;
  previousDnsProviderId: string | null;
  previousHostingProviderId: string | null;
  previousEmailProviderId: string | null;
  newDnsProviderId: string | null;
  newHostingProviderId: string | null;
  newEmailProviderId: string | null;
}

/**
 * Provider change with resolved names (for notifications).
 */
export interface ProviderChangeWithNames extends ProviderChange {
  previousDnsProvider: string | null;
  previousHostingProvider: string | null;
  previousEmailProvider: string | null;
  newDnsProvider: string | null;
  newHostingProvider: string | null;
  newEmailProvider: string | null;
}

/**
 * Certificate change details, including the classified kind.
 */
export interface CertificateChange {
  kind: CertificateChangeKind;
  caProviderChanged: boolean;
  issuerChanged: boolean;
  previousCaProviderId: string | null;
  previousIssuer: string | null;
  newCaProviderId: string | null;
  newIssuer: string | null;
}

/**
 * Certificate change with resolved names (for notifications).
 */
export interface CertificateChangeWithNames extends CertificateChange {
  previousCaProvider: string | null;
  newCaProvider: string | null;
}

/**
 * Provider snapshot data for comparison.
 */
export interface ProviderSnapshotData {
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
}

/**
 * Result of applying confirmation + flap-memory dampening.
 *
 * `snapshot` is null when the stored snapshot should be left untouched.
 * Callers must persist `snapshot` whenever it is non-null, even if they
 * skip sending a notification (disabled channels, muted domain, etc.).
 */
export interface CertificateDampeningResult {
  snapshot: CertificateSnapshotData | null;
  shouldNotify: boolean;
}

/**
 * Combined classification + dampening decision for one monitor tick.
 */
export interface CertificateChangeEvaluation {
  kind: CertificateChangeKind;
  change: CertificateChange;
  snapshotToWrite: CertificateSnapshotData | null;
  shouldNotify: boolean;
}
