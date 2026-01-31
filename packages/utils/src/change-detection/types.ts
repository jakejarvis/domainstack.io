/**
 * Change detection types for domain monitoring.
 *
 * These types represent the changes detected when comparing
 * domain snapshots over time.
 */

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
 * Certificate change details.
 */
export interface CertificateChange {
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
 * Registration snapshot data for comparison.
 */
export interface RegistrationSnapshotData {
  registrarProviderId: string | null;
  nameservers: { host: string }[];
  transferLock: boolean | null;
  statuses: string[];
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
 * Certificate snapshot data for comparison.
 */
export interface CertificateSnapshotData {
  caProviderId: string | null;
  issuer: string | null;
}
