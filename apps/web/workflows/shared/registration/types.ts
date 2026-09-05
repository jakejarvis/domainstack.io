/**
 * Registration shared step types.
 *
 * Internal types for step-to-step data transfer and typed errors.
 */

/**
 * Typed error for registration operations.
 * - unsupported_tld: Registry does not support RDAP/WHOIS
 * - not_found: Domain not found in registry
 *
 * Note: Transient errors (timeout, network issues) are thrown as RetryableError
 * and never returned to callers.
 */
export type RegistrationError = "unsupported_tld" | "not_found";

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
