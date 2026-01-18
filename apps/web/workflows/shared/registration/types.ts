/**
 * Registration shared step types.
 *
 * Internal types for step-to-step data transfer and typed errors.
 * Response types (RegistrationResponse) remain in lib/types/domain/registration.ts.
 */

/**
 * Typed error for registration operations.
 * - unsupported_tld: Registry does not support RDAP/WHOIS
 *
 * Note: Transient errors (timeout, network issues) are thrown as RetryableError
 * and never returned to callers.
 */
export type RegistrationError = "unsupported_tld";

/**
 * Internal type for RDAP lookup result (before step processing).
 * These are internal errors that get mapped to either:
 * - RegistrationError (permanent failure, returned to caller)
 * - RetryableError (transient failure, triggers retry)
 */
export type RdapLookupResult =
  | { success: true; recordJson: string }
  | { success: false; error: "unsupported_tld" | "timeout" | "retry" };

/**
 * Internal data structure for step-to-step transfer after RDAP lookup.
 * Contains the raw RDAP record as JSON for serialization across step boundaries.
 */
export interface RegistrationFetchData {
  recordJson: string;
}

/**
 * Result of the registration fetch step.
 * Discriminated union for type-safe error handling.
 */
export type FetchRegistrationResult =
  | { success: true; data: RegistrationFetchData }
  | { success: false; error: RegistrationError };
