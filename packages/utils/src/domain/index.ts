/**
 * Domain utilities re-exported from rdapper
 *
 * These functions provide domain parsing and validation using the Public Suffix List.
 */
export {
  /** Get all domain parts: registrable domain, TLD, and subdomain */
  getDomainParts,
  /** Extract the TLD from a domain (e.g., "example.co.uk" -> "co.uk") */
  getDomainTld,
  /** Check if a string looks like a valid domain */
  isLikelyDomain,
  /** Convert a domain to its registrable form (eTLD+1) */
  toRegistrableDomain,
} from "rdapper";

// Re-export the client-safe utilities for convenience in server files
export * from "./client";
