/**
 * Change detection functions for domain monitoring.
 *
 * These pure functions compare snapshot data to detect changes
 * in registration, providers, and certificates.
 */

import {
  CERT_CHANGE_CONFIRMATIONS,
  CERT_FLAP_MEMORY_SIZE,
  CERT_FLAP_MEMORY_WINDOW_DAYS,
  NOTIFIABLE_CERTIFICATE_CHANGE_KINDS,
} from "@domainstack/constants";
import type {
  CertificateChangeKind,
  CertificatePendingObservation,
  CertificateRecentIdentity,
  CertificateSnapshotData,
} from "@domainstack/types";

import { normalizeCertificateHex } from "../certificate-hex";
import { statusesAreEqual } from "./status";
import type {
  CertificateChange,
  CertificateChangeEvaluation,
  CertificateDampeningResult,
  ProviderChange,
  ProviderSnapshotData,
  RegistrationChange,
  RegistrationSnapshotData,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const NOTIFIABLE_KINDS: ReadonlySet<CertificateChangeKind> = new Set(
  NOTIFIABLE_CERTIFICATE_CHANGE_KINDS,
);

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
  const registrarChanged = previous.registrarProviderId !== current.registrarProviderId;

  // Defensive: Handle potential empty arrays
  const snapshotNameservers = previous.nameservers ?? [];
  const currentNameservers = current.nameservers ?? [];

  // Check nameserver changes (order-independent, case-insensitive per RFC 4343)
  const prevNsHosts = [...snapshotNameservers]
    .map((ns) => ns.host.toLowerCase())
    .sort((a, b) => a.localeCompare(b));
  const currNsHosts = [...currentNameservers]
    .map((ns) => ns.host.toLowerCase())
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
  if (!registrarChanged && !nameserversChanged && !transferLockChanged && !statusesChanged) {
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
  const hostingProviderChanged = previous.hostingProviderId !== current.hostingProviderId;
  const emailProviderChanged = previous.emailProviderId !== current.emailProviderId;

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
 * Classify the difference between two certificate snapshots.
 *
 * Decision order:
 * 1. Previous snapshot has no certificate identity (initialize placeholder)
 *    → `none`. First observation is committed silently by dampening.
 * 2. Both CA provider IDs non-null and different → `authority`
 *    (`null → X` / `X → null` is not an authority change — catalog miss).
 * 3. Both fingerprints known and equal → `none` (ignore issuer CN rotation).
 * 4. Both fingerprints known and different → `renewal` if `validTo` moved
 *    forward, else `reissue`.
 * 5. Fingerprint missing on either side (legacy) → degrade:
 *    `validTo` forward → `renewal`; serial changed → `reissue`;
 *    issuer changed → `intermediate`; else `none`.
 */
export function detectCertificateChange(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
): CertificateChange {
  const prevIssuer = previous.issuer ?? "";
  const currIssuer = current.issuer ?? "";
  const issuerChanged = prevIssuer !== currIssuer;

  const bothCaKnown = previous.caProviderId !== null && current.caProviderId !== null;
  const caProviderChanged = bothCaKnown && previous.caProviderId !== current.caProviderId;

  const details = {
    caProviderChanged,
    issuerChanged,
    previousCaProviderId: previous.caProviderId,
    previousIssuer: prevIssuer || null,
    newCaProviderId: current.caProviderId,
    newIssuer: currIssuer || null,
  };

  let kind: CertificateChangeKind;

  if (isUninitializedCertificate(previous)) {
    kind = "none";
  } else if (caProviderChanged) {
    kind = "authority";
  } else {
    const prevFp = normalizeCertificateHex(previous.fingerprint);
    const currFp = normalizeCertificateHex(current.fingerprint);

    if (prevFp && currFp) {
      if (prevFp === currFp) {
        kind = "none";
      } else if (validToMovedForward(previous, current)) {
        kind = "renewal";
      } else {
        kind = "reissue";
      }
    } else if (validToMovedForward(previous, current)) {
      kind = "renewal";
    } else if (serialChanged(previous.serialNumber, current.serialNumber)) {
      kind = "reissue";
    } else if (issuerChanged) {
      kind = "intermediate";
    } else {
      kind = "none";
    }
  }

  return { kind, ...details };
}

/**
 * Confirm notifiable certificate changes across observations and suppress
 * roll-forward/roll-back flaps using recent-identity memory.
 *
 * Persist `snapshot` whenever it is non-null. If a notification is attempted
 * and delivery fails, skip that write so the next tick can retry. Still persist
 * when channels are disabled or the change is not notifiable.
 */
export function applyCertificateDampening(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
  kind: CertificateChangeKind,
  now: Date = new Date(),
): CertificateDampeningResult {
  if (isUninitializedCertificate(previous)) {
    if (isUninitializedCertificate(current)) {
      return { snapshot: null, shouldNotify: false };
    }
    return { snapshot: commitSnapshot(previous, current, now), shouldNotify: false };
  }

  if (kind === "none") {
    return { snapshot: snapshotAfterNone(previous, current), shouldNotify: false };
  }

  if (kind === "intermediate") {
    return { snapshot: commitSnapshot(previous, current, now), shouldNotify: false };
  }

  if (!NOTIFIABLE_KINDS.has(kind)) {
    return { snapshot: null, shouldNotify: false };
  }

  const pending = previous.pending ?? null;

  if (!pending || !pendingMatches(pending, current)) {
    return {
      snapshot: withPending(previous, current, now, 1),
      shouldNotify: false,
    };
  }

  const observations = pending.observations + 1;
  if (observations < CERT_CHANGE_CONFIRMATIONS) {
    return {
      snapshot: withPending(previous, current, now, observations, pending.firstSeenAt),
      shouldNotify: false,
    };
  }

  const suppressed = identityInRecent(previous.recent ?? [], current, now);
  return {
    snapshot: commitSnapshot(previous, current, now),
    shouldNotify: !suppressed,
  };
}

/**
 * Classify a certificate observation and apply dampening in one step.
 */
export function evaluateCertificateChange(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
  now: Date = new Date(),
): CertificateChangeEvaluation {
  const change = detectCertificateChange(previous, current);
  const dampened = applyCertificateDampening(previous, current, change.kind, now);
  return {
    kind: change.kind,
    change,
    snapshotToWrite: dampened.snapshot,
    shouldNotify: dampened.shouldNotify,
  };
}

function isUninitializedCertificate(data: CertificateSnapshotData): boolean {
  return (
    normalizeCertificateHex(data.fingerprint) === null &&
    normalizeCertificateHex(data.serialNumber) === null &&
    !(data.issuer ?? "") &&
    data.caProviderId == null
  );
}

function serialChanged(
  previous: string | null | undefined,
  current: string | null | undefined,
): boolean {
  const prev = normalizeCertificateHex(previous);
  const curr = normalizeCertificateHex(current);
  return prev !== null && curr !== null && prev !== curr;
}

function parseSeenAt(seenAt: string): number | null {
  const ms = Date.parse(seenAt);
  return Number.isFinite(ms) ? ms : null;
}

function isWithinFlapWindow(seenAt: string, nowMs: number, windowMs: number): boolean {
  const ms = parseSeenAt(seenAt);
  if (ms === null) return false;
  return nowMs - ms <= windowMs;
}

function validToMovedForward(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
): boolean {
  const prev = Date.parse(previous.validTo);
  const curr = Date.parse(current.validTo);
  if (Number.isNaN(prev) || Number.isNaN(curr)) return false;
  return curr > prev;
}

function snapshotAfterNone(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
): CertificateSnapshotData | null {
  const prevFp = normalizeCertificateHex(previous.fingerprint);
  const healedFp = prevFp ?? normalizeCertificateHex(current.fingerprint);
  const prevSerial = normalizeCertificateHex(previous.serialNumber);
  const healedSerial = prevSerial ?? normalizeCertificateHex(current.serialNumber);
  const healedCa = previous.caProviderId ?? current.caProviderId;
  const pendingCleared = previous.pending != null;
  const identityHealed =
    healedFp !== prevFp || healedSerial !== prevSerial || healedCa !== previous.caProviderId;

  if (!pendingCleared && !identityHealed) {
    return null;
  }

  return {
    ...previous,
    caProviderId: healedCa,
    fingerprint: healedFp,
    serialNumber: healedSerial,
    pending: null,
  };
}

function pendingMatches(
  pending: CertificatePendingObservation,
  current: CertificateSnapshotData,
): boolean {
  const pendingFp = normalizeCertificateHex(pending.fingerprint);
  const currentFp = normalizeCertificateHex(current.fingerprint);
  if (pendingFp && currentFp) {
    return pendingFp === currentFp;
  }
  const pendingSerial = normalizeCertificateHex(pending.serialNumber);
  const currentSerial = normalizeCertificateHex(current.serialNumber);
  if (pendingSerial && currentSerial) {
    return pendingSerial === currentSerial;
  }
  return (
    pending.issuer === (current.issuer ?? "") &&
    pending.caProviderId === current.caProviderId &&
    pending.validTo === current.validTo
  );
}

function withPending(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
  now: Date,
  observations: number,
  firstSeenAt?: string,
): CertificateSnapshotData {
  return {
    ...previous,
    pending: {
      fingerprint: normalizeCertificateHex(current.fingerprint),
      caProviderId: current.caProviderId,
      issuer: current.issuer ?? "",
      validTo: current.validTo,
      serialNumber: normalizeCertificateHex(current.serialNumber),
      firstSeenAt: firstSeenAt ?? now.toISOString(),
      observations,
    },
  };
}

function identityEntry(
  data: CertificateSnapshotData,
  seenAt: string,
): CertificateRecentIdentity | null {
  const fingerprint = normalizeCertificateHex(data.fingerprint);
  const serialNumber = normalizeCertificateHex(data.serialNumber);
  if (!fingerprint && !data.caProviderId && !serialNumber) return null;
  return {
    fingerprint,
    caProviderId: data.caProviderId,
    serialNumber,
    validTo: data.validTo,
    seenAt,
  };
}

function identityInRecent(
  recent: CertificateRecentIdentity[],
  current: CertificateSnapshotData,
  now: Date,
): boolean {
  const windowMs = CERT_FLAP_MEMORY_WINDOW_DAYS * DAY_MS;
  const nowMs = now.getTime();
  const currentFp = normalizeCertificateHex(current.fingerprint);
  const currentSerial = normalizeCertificateHex(current.serialNumber);
  return recent.some((entry) => {
    if (!isWithinFlapWindow(entry.seenAt, nowMs, windowMs)) return false;
    const entryFp = normalizeCertificateHex(entry.fingerprint);
    if (currentFp && entryFp) return currentFp === entryFp;
    if (currentFp || entryFp) return false;
    const entrySerial = normalizeCertificateHex(entry.serialNumber);
    if (currentSerial && entrySerial) return currentSerial === entrySerial;
    if (currentSerial || entrySerial) return false;
    return (
      current.caProviderId !== null &&
      entry.caProviderId !== null &&
      current.caProviderId === entry.caProviderId &&
      Boolean(current.validTo) &&
      current.validTo === (entry.validTo ?? "")
    );
  });
}

function commitSnapshot(
  previous: CertificateSnapshotData,
  current: CertificateSnapshotData,
  now: Date,
): CertificateSnapshotData {
  const seenAt = now.toISOString();
  const windowMs = CERT_FLAP_MEMORY_WINDOW_DAYS * DAY_MS;
  const nowMs = now.getTime();

  const incoming = [
    ...(previous.recent ?? []),
    identityEntry(previous, seenAt),
    identityEntry(current, seenAt),
  ].filter((entry): entry is CertificateRecentIdentity => entry !== null);

  const recent = incoming
    .filter((entry) => isWithinFlapWindow(entry.seenAt, nowMs, windowMs))
    .slice(-CERT_FLAP_MEMORY_SIZE);

  return {
    caProviderId: current.caProviderId,
    issuer: current.issuer ?? "",
    validTo: current.validTo,
    fingerprint: normalizeCertificateHex(current.fingerprint),
    serialNumber: normalizeCertificateHex(current.serialNumber),
    pending: null,
    recent,
  };
}
