/**
 * WHOIS/RDAP module.
 *
 * Provides utilities for looking up domain registration data
 * via WHOIS and RDAP protocols.
 */

// Lookup functions
export * from "./lookup";
// Types
export * from "./types";

// Re-export status utilities from utils for backward compatibility
export { normalizeStatus, statusesAreEqual } from "@domainstack/utils/change-detection";
