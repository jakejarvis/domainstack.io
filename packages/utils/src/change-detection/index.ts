/**
 * Change detection utilities for domain monitoring.
 *
 * This module provides pure functions for detecting changes between
 * domain snapshots, used by monitoring workflows to identify when
 * registration, provider, or certificate details have changed.
 */

// Detection functions
export {
  applyCertificateDampening,
  detectCertificateChange,
  detectProviderChange,
  detectRegistrationChange,
  evaluateCertificateChange,
} from "./detection";
// Status utilities
export { normalizeStatus, statusesAreEqual } from "./status";
// Types
export type {
  CertificateChange,
  CertificateChangeEvaluation,
  CertificateChangeKind,
  CertificateChangeWithNames,
  CertificateDampeningResult,
  CertificatePendingObservation,
  CertificateRecentIdentity,
  CertificateSnapshotData,
  ProviderChange,
  ProviderChangeWithNames,
  ProviderSnapshotData,
  RegistrationChange,
  RegistrationSnapshotData,
} from "./types";
