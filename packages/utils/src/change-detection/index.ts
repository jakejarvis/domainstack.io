/**
 * Change detection utilities for domain monitoring.
 *
 * This module provides pure functions for detecting changes between
 * domain snapshots, used by monitoring workflows to identify when
 * registration, provider, or certificate details have changed.
 */

export {
  applyCertificateDampening,
  certificateSnapshotFrom,
  confirmChange,
  detectCertificateChange,
  detectProviderChange,
  detectRegistrationChange,
  evaluateCertificateChange,
  isUninitializedRegistration,
  providerObservationKey,
  registrationObservationKey,
  registrationSnapshotFrom,
} from "./detection";
export { normalizeStatus, statusesAreEqual } from "./status";
