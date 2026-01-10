import "server-only";

import type {
  CertificateSnapshotData,
  ProviderSnapshotData,
  RegistrationSnapshotData,
} from "@/lib/db/repos/snapshots";

// =============================================================================
// Change Types
// =============================================================================

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
export interface HostingChange {
  dnsProviderChanged: boolean;
  hostingProviderChanged: boolean;
  emailProviderChanged: boolean;
  previousDnsProvider: string | null;
  previousHostingProvider: string | null;
  previousEmailProvider: string | null;
  newDnsProvider: string | null;
  newHostingProvider: string | null;
  newEmailProvider: string | null;
  previousDnsProviderId: string | null;
  previousHostingProviderId: string | null;
  previousEmailProviderId: string | null;
  newDnsProviderId: string | null;
  newHostingProviderId: string | null;
  newEmailProviderId: string | null;
}

/**
 * Certificate change details.
 */
export interface CertificateChange {
  caProviderChanged: boolean;
  issuerChanged: boolean;
  previousCaProvider: string | null;
  previousIssuer: string | null;
  newCaProvider: string | null;
  newIssuer: string | null;
  previousCaProviderId: string | null;
  newCaProviderId: string | null;
}

// =============================================================================
// Change Detection Functions
// =============================================================================

/**
 * Detect changes in registration data (registrar, nameservers, transfer lock, statuses).
 */
export function detectRegistrationChanges(
  snapshot: RegistrationSnapshotData,
  current: RegistrationSnapshotData,
): RegistrationChange | null {
  const registrarChanged =
    snapshot.registrarProviderId !== current.registrarProviderId;

  // Defensive: Handle potential empty objects from createSnapshot defaults
  const snapshotNameservers = snapshot.nameservers ?? [];
  const currentNameservers = current.nameservers ?? [];
  const nameserversChanged = !arraysEqual(
    [...snapshotNameservers]
      .map((ns) => ns.host)
      .sort((a, b) => a.localeCompare(b)),
    [...currentNameservers]
      .map((ns) => ns.host)
      .sort((a, b) => a.localeCompare(b)),
  );

  const transferLockChanged = snapshot.transferLock !== current.transferLock;

  const snapshotStatuses = snapshot.statuses ?? [];
  const currentStatuses = current.statuses ?? [];
  const statusesChanged = !arraysEqual(
    [...snapshotStatuses].sort((a, b) => a.localeCompare(b)),
    [...currentStatuses].sort((a, b) => a.localeCompare(b)),
  );

  // If nothing changed, return null
  if (
    !registrarChanged &&
    !nameserversChanged &&
    !transferLockChanged &&
    !statusesChanged
  ) {
    return null;
  }

  // Something changed, return the change details
  return {
    registrarChanged,
    nameserversChanged,
    transferLockChanged,
    statusesChanged,
    previousRegistrar: snapshot.registrarProviderId,
    previousNameservers: snapshotNameservers,
    previousTransferLock: snapshot.transferLock,
    previousStatuses: snapshotStatuses,
    newRegistrar: current.registrarProviderId,
    newNameservers: currentNameservers,
    newTransferLock: current.transferLock,
    newStatuses: currentStatuses,
  };
}

/**
 * Detect changes in provider IDs (DNS, hosting, email).
 * These are derived from the hosting table.
 */
export function detectProviderChanges(
  snapshot: ProviderSnapshotData,
  current: ProviderSnapshotData,
): HostingChange | null {
  const dnsProviderChanged = snapshot.dnsProviderId !== current.dnsProviderId;
  const hostingProviderChanged =
    snapshot.hostingProviderId !== current.hostingProviderId;
  const emailProviderChanged =
    snapshot.emailProviderId !== current.emailProviderId;

  // If nothing changed, return null
  if (!dnsProviderChanged && !hostingProviderChanged && !emailProviderChanged) {
    return null;
  }

  // Something changed, return the change details
  // Note: Provider names will be fetched separately in the monitoring job
  return {
    dnsProviderChanged,
    hostingProviderChanged,
    emailProviderChanged,
    previousDnsProvider: null,
    previousHostingProvider: null,
    previousEmailProvider: null,
    newDnsProvider: null,
    newHostingProvider: null,
    newEmailProvider: null,
    previousDnsProviderId: snapshot.dnsProviderId,
    previousHostingProviderId: snapshot.hostingProviderId,
    previousEmailProviderId: snapshot.emailProviderId,
    newDnsProviderId: current.dnsProviderId,
    newHostingProviderId: current.hostingProviderId,
    newEmailProviderId: current.emailProviderId,
  };
}

/**
 * Detect changes in certificate data (CA provider, issuer).
 */
export function detectCertificateChanges(
  snapshot: CertificateSnapshotData,
  current: CertificateSnapshotData,
): CertificateChange | null {
  const caProviderChanged = snapshot.caProviderId !== current.caProviderId;
  const issuerChanged = snapshot.issuer !== current.issuer;

  // If nothing changed, return null
  if (!caProviderChanged && !issuerChanged) {
    return null;
  }

  // Something changed, return the change details
  // Note: CA provider names will be fetched separately in the monitoring job
  return {
    caProviderChanged,
    issuerChanged,
    previousCaProvider: null,
    previousIssuer: snapshot.issuer,
    newCaProvider: null,
    newIssuer: current.issuer,
    previousCaProviderId: snapshot.caProviderId,
    newCaProviderId: current.caProviderId,
  };
}

/**
 * Helper function to compare two arrays for equality.
 * Arrays must be sorted before comparison.
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
