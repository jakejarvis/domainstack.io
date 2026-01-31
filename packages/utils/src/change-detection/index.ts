/**
 * Change detection utilities for domain monitoring.
 *
 * This module provides pure functions for detecting changes between
 * domain snapshots, used by monitoring workflows to identify when
 * registration, provider, or certificate details have changed.
 */

// Detection functions
export {
  detectCertificateChange,
  detectProviderChange,
  detectRegistrationChange,
} from "./detection";
// Status utilities
export { normalizeStatus, statusesAreEqual } from "./status";
// Types
export type {
  CertificateChange,
  CertificateChangeWithNames,
  CertificateSnapshotData,
  ProviderChange,
  ProviderChangeWithNames,
  ProviderSnapshotData,
  RegistrationChange,
  RegistrationSnapshotData,
} from "./types";
