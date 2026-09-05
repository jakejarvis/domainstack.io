/**
 * Change detection utilities for domain monitoring.
 *
 * This module provides pure functions for detecting changes between
 * domain snapshots, used by monitoring workflows to identify when
 * registration, provider, or certificate details have changed.
 */

export {
  applyCertificateDampening,
  detectCertificateChange,
  detectProviderChange,
  detectRegistrationChange,
  evaluateCertificateChange,
} from "./detection";
export { normalizeStatus, statusesAreEqual } from "./status";
