/**
 * WHOIS/RDAP module.
 *
 * Provides utilities for looking up domain registration data
 * via WHOIS and RDAP protocols.
 */

// Re-export status utilities from utils for backward compatibility
export {
  normalizeStatus,
  statusesAreEqual,
} from "@domainstack/utils/change-detection";
// Lookup functions
export * from "./lookup";
// Types
export * from "./types";
