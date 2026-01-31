/**
 * Change detection functions for domain monitoring.
 *
 * These pure functions compare snapshot data to detect changes
 * in registration, providers, and certificates.
 */

import { statusesAreEqual } from "./status";
import type {
  CertificateChange,
  CertificateSnapshotData,
  ProviderChange,
  ProviderSnapshotData,
  RegistrationChange,
  RegistrationSnapshotData,
} from "./types";

/**
 * Detect changes between two registration snapshots.
 *
 * Compares registrar, nameservers, transfer lock, and statuses.
 * Returns null if no changes detected.
 *
 * @param previous - Previous registration snapshot
 * @param current - Current registration snapshot
 * @returns Change details or null if unchanged
 */
export function detectRegistrationChange(
  previous: RegistrationSnapshotData,
  current: RegistrationSnapshotData,
): RegistrationChange | null {
  const registrarChanged =
    previous.registrarProviderId !== current.registrarProviderId;

  // Defensive: Handle potential empty arrays
  const snapshotNameservers = previous.nameservers ?? [];
  const currentNameservers = current.nameservers ?? [];

  // Check nameserver changes (order-independent comparison)
  const prevNsHosts = [...snapshotNameservers]
    .map((ns) => ns.host)
    .sort((a, b) => a.localeCompare(b));
  const currNsHosts = [...currentNameservers]
    .map((ns) => ns.host)
    .sort((a, b) => a.localeCompare(b));
  const nameserversChanged =
    prevNsHosts.length !== currNsHosts.length ||
    prevNsHosts.some((host, i) => host !== currNsHosts[i]);

  const transferLockChanged = previous.transferLock !== current.transferLock;

  // Check status changes (using normalized comparison to handle formatting differences)
  const snapshotStatuses = previous.statuses ?? [];
  const currentStatuses = current.statuses ?? [];
  const statusesChanged = !statusesAreEqual(snapshotStatuses, currentStatuses);

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
    previousRegistrar: previous.registrarProviderId,
    previousNameservers: snapshotNameservers,
    previousTransferLock: previous.transferLock,
    previousStatuses: snapshotStatuses,
    newRegistrar: current.registrarProviderId,
    newNameservers: currentNameservers,
    newTransferLock: current.transferLock,
    newStatuses: currentStatuses,
  };
}

/**
 * Detect changes between two provider snapshots.
 *
 * Compares DNS, hosting, and email provider IDs.
 * Returns null if no changes detected.
 *
 * @param previous - Previous provider snapshot
 * @param current - Current provider snapshot
 * @returns Change details or null if unchanged
 */
export function detectProviderChange(
  previous: ProviderSnapshotData,
  current: ProviderSnapshotData,
): ProviderChange | null {
  const dnsProviderChanged = previous.dnsProviderId !== current.dnsProviderId;
  const hostingProviderChanged =
    previous.hostingProviderId !== current.hostingProviderId;
  const emailProviderChanged =
    previous.emailProviderId !== current.emailProviderId;

  // If nothing changed, return null
  if (!dnsProviderChanged && !hostingProviderChanged && !emailProviderChanged) {
    return null;
  }

  // Something changed, return the change details
  return {
    dnsProviderChanged,
    hostingProviderChanged,
    emailProviderChanged,
    previousDnsProviderId: previous.dnsProviderId,
    previousHostingProviderId: previous.hostingProviderId,
    previousEmailProviderId: previous.emailProviderId,
    newDnsProviderId: current.dnsProviderId,
    newHostingProviderId: current.hostingProviderId,
    newEmailProviderId: current.emailProviderId,
  };
}

/**
 * Detect changes between two certificate snapshots.
 *
 * Compares CA provider and issuer.
 * Returns null if no changes detected.
 *
 * @param previous - Previous certificate snapshot
 * @param current - Current certificate snapshot
 * @returns Change details or null if unchanged
 */
export function detectCertificateChange(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
): CertificateChange | null {
  const caProviderChanged = previous.caProviderId !== current.caProviderId;
  const issuerChanged = previous.issuer !== current.issuer;

  // If nothing changed, return null
  if (!caProviderChanged && !issuerChanged) {
    return null;
  }

  // Something changed, return the change details
  return {
    caProviderChanged,
    issuerChanged,
    previousCaProviderId: previous.caProviderId,
    previousIssuer: previous.issuer,
    newCaProviderId: current.caProviderId,
    newIssuer: current.issuer,
  };
}
