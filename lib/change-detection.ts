import "server-only";

import type {
  CertificateSnapshotData,
  ProviderSnapshotData,
  RegistrationSnapshotData,
} from "@/lib/db/repos/snapshots";
import type {
  CertificateChange,
  ProviderChange,
  RegistrationChange,
} from "@/lib/schemas/internal/changes";

/**
 * Detect changes in registration data (registrar, nameservers, transfer lock, statuses).
 */
export function detectRegistrationChanges(
  snapshot: RegistrationSnapshotData,
  current: RegistrationSnapshotData,
): RegistrationChange | null {
  const registrarChanged =
    snapshot.registrarProviderId !== current.registrarProviderId;

  const nameserversChanged = !arraysEqual(
    snapshot.nameservers.map((ns) => ns.host).sort(),
    current.nameservers.map((ns) => ns.host).sort(),
  );

  const transferLockChanged = snapshot.transferLock !== current.transferLock;

  const statusesChanged = !arraysEqual(
    snapshot.statuses.sort(),
    current.statuses.sort(),
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
    previousNameservers: snapshot.nameservers,
    previousTransferLock: snapshot.transferLock,
    previousStatuses: snapshot.statuses,
    newRegistrar: current.registrarProviderId,
    newNameservers: current.nameservers,
    newTransferLock: current.transferLock,
    newStatuses: current.statuses,
  };
}

/**
 * Detect changes in provider IDs (DNS, hosting, email).
 * These are derived from the hosting table.
 */
export function detectProviderChanges(
  snapshot: ProviderSnapshotData,
  current: ProviderSnapshotData,
): ProviderChange | null {
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
    previousCAProvider: null,
    previousIssuer: snapshot.issuer,
    newCAProvider: null,
    newIssuer: current.issuer,
    previousCAProviderId: snapshot.caProviderId,
    newCAProviderId: current.caProviderId,
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
